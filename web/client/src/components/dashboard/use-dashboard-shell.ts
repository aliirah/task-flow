'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { toast } from 'sonner'

import { authApi, organizationApi, refreshToken as requestTokenRefresh } from '@/lib/api'
import type { Organization, OrganizationMember } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { buildWsUrl } from '@/lib/utils/ws'
import type { TaskEventMessage } from '@/lib/types/ws'
import { TaskEventListener } from '@/hooks/useTaskEvents'
import { useAuthStore } from '@/store/auth'

import type { DashboardContextValue } from './context'

const STORAGE_KEY = 'dashboard:selected-org'

export function useDashboardShellLogic() {
  const router = useRouter()
  const pathname = usePathname()
  const currentPath = pathname ?? '/'
  const {
    user,
    refreshToken: storedRefreshToken,
    clearAuth,
    accessToken,
    expiresAt,
  } = useAuthStore()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [orgQuery, setOrgQuery] = useState('')
  const orgMenuRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const storedOrgRef = useRef<string | null>(null)

  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState<
    string | null
  >(null)
  const [selectionHydrated, setSelectionHydrated] = useState(false)
  const taskEventListenersRef = useRef<Set<TaskEventListener>>(new Set())
  const userRef = useRef(user)
  const selectedOrgRef = useRef<string | null>(selectedOrganizationId)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    selectedOrgRef.current = selectedOrganizationId
  }, [selectedOrganizationId])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [currentPath])

  useEffect(() => {
    if (typeof window === 'undefined') return
    storedOrgRef.current = window.localStorage.getItem(STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    if (!storedRefreshToken || !expiresAt) {
      return
    }
    const expiryTime = new Date(expiresAt).getTime()
    if (Number.isNaN(expiryTime)) {
      return
    }
    const now = Date.now()
    const leadTime = 60_000

    const scheduleRefresh = async () => {
      const refreshed = await requestTokenRefresh()
      if (!refreshed) {
        clearAuth()
        Cookies.remove('accessToken')
        router.replace('/auth/login')
      }
    }

    if (expiryTime - now <= leadTime) {
      scheduleRefresh()
      return
    }

    const delay = Math.max(expiryTime - now - leadTime, 5_000)
    refreshTimerRef.current = setTimeout(scheduleRefresh, delay)

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [storedRefreshToken, expiresAt, clearAuth, router])

  const refreshOrganizations = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setOrganizations([])
      setSelectedOrganizationIdState(null)
      setSelectionHydrated(true)
      return
    }
    setLoadingOrganizations(true)
    try {
      const response = await organizationApi.listMine()
      const items = response.data?.items ?? []
      setMemberships(items)

      const unique = new Map<string, Organization>()
      items.forEach((membership) => {
        if (membership.organization) {
          unique.set(membership.organization.id, membership.organization)
        }
      })
      const list = Array.from(unique.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      setOrganizations(list)

      setSelectedOrganizationIdState((current) => {
        const stored = storedOrgRef.current
        storedOrgRef.current = null

        if (current && list.some((org) => org.id === current)) {
          return current
        }
        if (stored && list.some((org) => org.id === stored)) {
          return stored
        }
        return list[0]?.id ?? null
      })
    } catch (error) {
      handleApiError({ error })
    } finally {
      setLoadingOrganizations(false)
      setSelectionHydrated(true)
    }
  }, [user])

  useEffect(() => {
    refreshOrganizations()
  }, [refreshOrganizations])

  useEffect(() => {
    if (!selectionHydrated || typeof window === 'undefined') return
    if (selectedOrganizationId) {
      window.localStorage.setItem(STORAGE_KEY, selectedOrganizationId)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedOrganizationId, selectionHydrated])

  useEffect(() => {
    if (!accessToken) {
      return
    }
    let stop = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let socket: WebSocket | null = null

    const connect = () => {
      const wsUrl = buildWsUrl(`/api/ws?token=${encodeURIComponent(accessToken)}`)
      console.debug('[dashboard-shell] opening websocket', wsUrl)
      socket = new WebSocket(wsUrl)

      socket.onclose = () => {
        if (stop) {
          return
        }
        console.debug('[dashboard-shell] websocket closed, scheduling retry')
        retryTimer = setTimeout(connect, 5000)
      }

      socket.onerror = () => {
        console.warn('[dashboard-shell] websocket error, closing socket')
        socket?.close()
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.debug('[dashboard-shell] incoming websocket payload', message)
          if (!message?.type) {
            return
          }
          if (message.type === 'connection.established') {
            return
          }

          // Handle notification events
          if (message.type === 'notification.created' && message.data) {
            console.debug('[dashboard-shell] received notification', message.data)
            // Call the global notification handler if available
            if (typeof window !== 'undefined') {
              const addNotification = (window as unknown as { __addNotification?: (data: unknown) => void }).__addNotification
              if (typeof addNotification === 'function') {
                addNotification(message.data)
              }
            }
            // Show a brief toast for new notifications
            toast.info(message.data.title, {
              description: message.data.message,
              duration: 3000,
            })
            return
          }

          // Handle task events (keep for live updates, remove toast)
          const isTaskEvent =
            message.type === 'task.event.created' ||
            message.type === 'task.event.updated'
          if (!isTaskEvent || !message.data) {
            return
          }
          const senderId =
            message.data.triggeredById ?? message.data.reporterId ?? null
          if (senderId && senderId === userRef.current?.id) {
            return
          }
          const taskEvent = message as TaskEventMessage
          taskEventListenersRef.current.forEach((listener) => {
            try {
              listener(taskEvent)
            } catch {
              /* ignore */
            }
          })
          // Note: Removed toast.success call here - notifications will be shown via NotificationBell instead
        } catch {
          // ignore parse errors
        }
      }
    }

    connect()

    return () => {
      stop = true
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
      socket?.close()
    }
  }, [accessToken])

  useEffect(() => {
    if (!orgMenuOpen) {
      setOrgQuery('')
    }
  }, [orgMenuOpen])

  useEffect(() => {
    if (!orgMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (
        orgMenuRef.current &&
        !orgMenuRef.current.contains(event.target as Node)
      ) {
        setOrgMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [orgMenuOpen])

  useEffect(() => {
    if (!userMenuOpen) return
    const onClick = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [userMenuOpen])

  const subscribeTaskEvents = useCallback((listener: TaskEventListener) => {
    taskEventListenersRef.current.add(listener)
    return () => {
      taskEventListenersRef.current.delete(listener)
    }
  }, [])

  const filteredOrganizations = useMemo(() => {
    if (!orgQuery.trim()) {
      return organizations
    }
    const query = orgQuery.toLowerCase()
    return organizations.filter((org) =>
      [org.name, org.description].some((value) =>
        value?.toLowerCase().includes(query)
      )
    )
  }, [organizations, orgQuery])

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId]
  )

  const selectedMembership = useMemo(
    () =>
      memberships.find(
        (membership) =>
          membership.organizationId === selectedOrganizationId ||
          membership.organization?.id === selectedOrganizationId
      ),
    [memberships, selectedOrganizationId]
  )

  const initials = useMemo(() => {
    if (!user) return 'TF'
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
  }, [user])

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      if (storedRefreshToken) {
        await authApi.logout(storedRefreshToken)
      }
      toast.success('Signed out')
    } catch (error) {
      console.error('logout failed', error)
    } finally {
      clearAuth()
      Cookies.remove('accessToken')
      setSelectedOrganizationIdState(null)
      setIsLoggingOut(false)
      setLogoutConfirmOpen(false)
      router.replace('/auth/login')
    }
  }, [clearAuth, router, storedRefreshToken])

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      organizations,
      memberships,
      selectedOrganizationId,
      selectedOrganization,
      setSelectedOrganizationId: setSelectedOrganizationIdState,
      refreshOrganizations,
      loadingOrganizations,
      sidebarCollapsed,
      setSidebarCollapsed,
    }),
    [
      organizations,
      memberships,
      selectedOrganizationId,
      selectedOrganization,
      refreshOrganizations,
      loadingOrganizations,
      sidebarCollapsed,
    ]
  )

  const taskEventContextValue = useMemo(
    () => ({
      subscribe: subscribeTaskEvents,
    }),
    [subscribeTaskEvents]
  )

  return {
    router,
    currentPath,
    user,
    contextValue,
    taskEventContextValue,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    orgMenuOpen,
    setOrgMenuOpen,
    userMenuOpen,
    setUserMenuOpen,
    orgQuery,
    setOrgQuery,
    orgMenuRef,
    userMenuRef,
    loadingOrganizations,
    filteredOrganizations,
    memberships,
    selectedOrganization,
    selectedOrganizationId,
    selectedMembership,
    handleLogout,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    isLoggingOut,
    initials,
    setSelectedOrganizationId: setSelectedOrganizationIdState,
    refreshOrganizations,
  }
}
