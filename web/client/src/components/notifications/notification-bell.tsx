'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { notificationApi } from '@/lib/api/notification'
import type { Notification } from '@/lib/types/api'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

interface NotificationBellProps {
  onNewNotification?: (notification: Notification) => void
}

export function NotificationBell({ onNewNotification }: NotificationBellProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const isFetchingRef = useRef(false)

  // Fetch unread count - TEMPORARILY DISABLED FOR DEBUGGING
  // const fetchUnreadCount = async () => {
  //   try {
  //     const response = await notificationApi.getUnreadCount()
  //     setUnreadCount(response.data.count || 0)
  //   } catch (error) {
  //     console.error('Failed to fetch unread count:', error)
  //     // Set to 0 on error so the badge doesn't show
  //     setUnreadCount(0)
  //   }
  // }

  // Fetch notifications when popover opens
  const fetchNotifications = useCallback(async () => {
    if (isFetchingRef.current) return // Prevent multiple simultaneous fetches
    
    isFetchingRef.current = true
    setLoading(true)
    try {
      const response = await notificationApi.list({ limit: 20 })
      setNotifications(response.data.items || [])
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      // Set empty array on error so UI doesn't stay in loading state
      setNotifications([])
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  // Initial fetch of unread count - TEMPORARILY DISABLED FOR DEBUGGING
  // useEffect(() => {
  //   fetchUnreadCount()
  // }, [])

  // Fetch notifications when popover opens
  useEffect(() => {
    if (isOpen) {
      console.log('[NotificationBell] Popover opened, fetching notifications...')
      console.log('[NotificationBell] Auth token:', useAuthStore.getState().accessToken ? 'Present' : 'Missing')
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark as read if unread
      if (!notification.isRead) {
        await notificationApi.markAsRead(notification.id)
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }

      // Navigate to the URL
      if (notification.url) {
        setIsOpen(false)
        router.push(notification.url)
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  // Public method to add new notification (called from WebSocket)
  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev])
    if (!notification.isRead) {
      setUnreadCount((prev) => prev + 1)
    }
    onNewNotification?.(notification)
  }, [onNewNotification])

  // Expose methods via ref would be better, but for now we'll use a different approach
  useEffect(() => {
    // Store the addNotification function globally so WebSocket handler can access it
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __addNotification: typeof addNotification }).__addNotification = addNotification
    }
  }, [addNotification])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No notifications yet
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b transition-colors ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
