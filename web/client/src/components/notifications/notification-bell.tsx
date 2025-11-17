'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { notificationApi } from '@/lib/api/notification'
import type { Notification } from '@/lib/types/api'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

export function NotificationBell() {
  const router = useRouter()
  const accessToken = useAuthStore((state) => state.accessToken)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const isFetchingRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const initialFetchDone = useRef(false)

  // Fetch unread count (only for initial load and after mark as read)
  const fetchUnreadCount = useCallback(async (retries = 2) => {
    if (!accessToken) {
      setUnreadCount(0)
      return
    }
    try {
      const response = await notificationApi.getUnreadCount()
      console.log('[NotificationBell] Fetched unread count:', response.data.count)
      setUnreadCount(response.data.count)
    } catch (error: any) {
      // Retry on connection errors
      if (retries > 0 && error?.message?.includes('connection')) {
        console.log('[NotificationBell] Connection error, retrying...', retries)
        await new Promise(resolve => setTimeout(resolve, 1000))
        return fetchUnreadCount(retries - 1)
      }
      console.error('[NotificationBell] Failed to fetch unread count:', error)
    }
  }, [accessToken])

  // Fetch notifications
  const fetchNotifications = useCallback(async (pageNum = 1, unreadOnly = false, append = false, retries = 2) => {
    if (!accessToken) {
      if (!append) {
        setNotifications([])
        setHasMore(false)
      }
      return
    }
    if (isFetchingRef.current) return
    
    isFetchingRef.current = true
    if (!append) {
      setLoading(true)
    }
    
    try {
      const response = await notificationApi.list({ 
        page: pageNum, 
        limit: 20,
        unreadOnly 
      })
      
      const newNotifications = response.data.items || []
      const unreadInResponse = newNotifications.filter(n => !n.isRead).length
      console.log('[NotificationBell] Fetched notifications:', {
        page: pageNum,
        count: newNotifications.length,
        unreadOnly,
        unreadInResponse,
        hasMore: response.data.hasMore,
        notifications: newNotifications.map(n => ({ 
          id: n.id, 
          title: n.title, 
          isRead: n.isRead,
          isReadType: typeof n.isRead,
          rawIsRead: JSON.stringify(n.isRead)
        }))
      })
      
      if (append) {
        setNotifications((prev) => [...prev, ...newNotifications])
      } else {
        setNotifications(newNotifications)
      }
      
      setHasMore(response.data.hasMore || false)
      setPage(pageNum)
    } catch (error: any) {
      // Retry on connection errors
      if (retries > 0 && error?.message?.includes('connection')) {
        console.log('[NotificationBell] Connection error, retrying...', retries)
        isFetchingRef.current = false
        await new Promise(resolve => setTimeout(resolve, 1000))
        return fetchNotifications(pageNum, unreadOnly, append, retries - 1)
      }
      
      console.error('Failed to fetch notifications:', error)
      if (!append) {
        setNotifications([])
      }
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [accessToken])

  // Initial fetch on mount only
  useEffect(() => {
    if (!accessToken) {
      initialFetchDone.current = false
      setNotifications([])
      setUnreadCount(0)
      setHasMore(false)
      return
    }
    if (!initialFetchDone.current) {
      initialFetchDone.current = true
      console.log('[NotificationBell] Initial fetch - unreadOnly: false')
      fetchUnreadCount()
      fetchNotifications(1, false, false)
    }
  }, [accessToken, fetchUnreadCount, fetchNotifications])

  // Refetch when filter changes
  useEffect(() => {
    if (initialFetchDone.current && accessToken) {
      console.log('[NotificationBell] Filter changed - showUnreadOnly:', showUnreadOnly)
      setPage(1)
      fetchNotifications(1, showUnreadOnly, false)
    }
  }, [showUnreadOnly, fetchNotifications, accessToken])

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || loading || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Load more when scrolled 80% down
    if (scrollPercentage > 0.8) {
      fetchNotifications(page + 1, showUnreadOnly, true)
    }
  }, [loading, hasMore, page, showUnreadOnly, fetchNotifications])

  // Generate frontend URL from notification
  const generateNotificationUrl = (notification: Notification): string => {
    // Extract task ID from the backend URL pattern
    const urlMatch = notification.url?.match(/\/tasks\/([a-f0-9-]+)(#comment-([a-f0-9-]+))?/)
    
    if (urlMatch) {
      const taskId = urlMatch[1]
      const commentId = urlMatch[3]
      
      if (commentId) {
        // For comments, go to task page with comment anchor
        return `/dashboard/tasks/${taskId}#comment-${commentId}`
      } else {
        // For tasks, go to task detail page
        return `/dashboard/tasks/${taskId}`
      }
    }
    
    // Fallback: if URL already starts with /dashboard, use it as-is
    if (notification.url?.startsWith('/dashboard')) {
      return notification.url
    }
    
    // Default fallback
    return '/dashboard'
  }

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark as read if unread
      if (!notification.isRead) {
        console.log('[NotificationBell] Marking notification as read:', notification.id)
        await notificationApi.markAsRead(notification.id)
        
        // Update local state immediately
        setNotifications((prev) => {
          const updated = prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          )
          console.log('[NotificationBell] Updated notifications:', updated.find(n => n.id === notification.id))
          return updated
        })
        
        // Fetch fresh count from server
        await fetchUnreadCount()
      }

      // Generate and navigate to the correct URL
      const url = generateNotificationUrl(notification)
      setIsOpen(false)
      router.push(url)
    } catch (error) {
      console.error('[NotificationBell] Failed to mark notification as read:', error)
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      console.log('[NotificationBell] Marking all as read')
      await notificationApi.markAllAsRead()
      
      setNotifications((prev) => {
        const updated = prev.map((n) => ({ ...n, isRead: true }))
        console.log('[NotificationBell] Updated all notifications to read')
        return updated
      })
      
      setUnreadCount(0)
      console.log('[NotificationBell] Set unread count to 0')
      await fetchUnreadCount()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  // Public method to add/update notification (called from WebSocket)
  const addNotification = useCallback(async (notification: Notification) => {
    console.log('[NotificationBell] 📬 WebSocket notification received:', {
      id: notification.id,
      title: notification.title,
      isRead: notification.isRead,
      isReadType: typeof notification.isRead,
      rawNotification: notification,
      currentShowUnreadOnly: showUnreadOnly
    })
    
    setNotifications((prev) => {
      // Check if notification already exists (update case)
      const existingIndex = prev.findIndex(n => n.id === notification.id)
      
      if (existingIndex >= 0) {
        // Update existing notification
        const updated = [...prev]
        const oldNotification = updated[existingIndex]
        updated[existingIndex] = notification
        
        console.log('[NotificationBell] Updated existing notification:', {
          oldIsRead: oldNotification.isRead,
          newIsRead: notification.isRead
        })
        
        return updated
      } else {
        // Add new notification at the beginning
        console.log('[NotificationBell] Adding new notification, isRead:', notification.isRead)
        return [notification, ...prev]
      }
    })
    
    // Always fetch fresh count from server after WebSocket update
    await fetchUnreadCount()
  }, [showUnreadOnly, fetchUnreadCount])

  // Expose methods via window global for WebSocket handler
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __addNotification: typeof addNotification }).__addNotification = addNotification
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __addNotification?: typeof addNotification }).__addNotification
      }
    }
  }, [addNotification])

  const formatTime = (dateString: string) => {
    if (!dateString) return ''
    
    try {
      const date = new Date(dateString)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Recently'
      }
      
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
    } catch {
      return 'Recently'
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-3 py-2 border-b bg-gray-50/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowUnreadOnly(false)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                !showUnreadOnly
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setShowUnreadOnly(true)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                showUnreadOnly
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              Unread
            </button>
            {unreadCount > 0 && (
              <span className="text-[11px] text-gray-500 ml-auto">
                {unreadCount} new
              </span>
            )}
          </div>
        </div>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="max-h-[280px] overflow-y-auto"
        >
          {loading ? (
            <div className="py-6 text-center text-xs text-gray-400">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative transition-colors cursor-pointer ${
                    !notification.isRead 
                      ? 'bg-blue-50/30 hover:bg-blue-50/40 border-l-2 border-blue-400' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="px-3 py-1.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className={`text-xs truncate flex-1 ${
                            !notification.isRead ? 'font-medium text-gray-900' : 'font-normal text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                        <p className={`text-[11px] line-clamp-2 mb-0.5 ${
                          !notification.isRead ? 'text-gray-600' : 'text-gray-500'
                        }`}>
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await notificationApi.markAsRead(notification.id)
                              setNotifications((prev) =>
                                prev.map((n) =>
                                  n.id === notification.id ? { ...n, isRead: true } : n
                                )
                              )
                              // Fetch fresh count from server
                              await fetchUnreadCount()
                            } catch (error) {
                              console.error('Failed to mark notification as read:', error)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:text-blue-700 font-medium shrink-0 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-all"
                          title="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && page > 1 && (
                <div className="py-3 text-center text-[11px] text-gray-400">
                  Loading more...
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
