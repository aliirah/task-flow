'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { notificationApi } from '@/lib/api/notification'
import type { Notification } from '@/lib/types/api'
import { useRouter } from 'next/navigation'

interface NotificationBellProps {
  onNewNotification?: (notification: Notification) => void
}

export function NotificationBell({ onNewNotification }: NotificationBellProps) {
  const router = useRouter()
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
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await notificationApi.getUnreadCount()
      console.log('[NotificationBell] Fetched unread count:', response.data.count)
      setUnreadCount(response.data.count)
    } catch (error) {
      console.error('[NotificationBell] Failed to fetch unread count:', error)
    }
  }, [])

  // Fetch notifications
  const fetchNotifications = useCallback(async (pageNum = 1, unreadOnly = false, append = false) => {
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
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      if (!append) {
        setNotifications([])
      }
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  // Initial fetch on mount only
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true
      console.log('[NotificationBell] Initial fetch - unreadOnly: false')
      fetchUnreadCount()
      fetchNotifications(1, false, false)
    }
  }, [fetchUnreadCount, fetchNotifications])

  // Refetch when filter changes
  useEffect(() => {
    if (initialFetchDone.current) {
      console.log('[NotificationBell] Filter changed - showUnreadOnly:', showUnreadOnly)
      setPage(1)
      fetchNotifications(1, showUnreadOnly, false)
    }
  }, [showUnreadOnly, fetchNotifications])

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
        
        setUnreadCount((prev) => {
          const newCount = Math.max(0, prev - 1)
          console.log('[NotificationBell] Updated unread count:', prev, '->', newCount)
          return newCount
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
  const addNotification = useCallback((notification: Notification) => {
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
        
        // Update unread count if read status changed
        if (oldNotification.isRead !== notification.isRead) {
          setUnreadCount(prevCount => {
            const newCount = notification.isRead 
              ? Math.max(0, prevCount - 1) 
              : prevCount + 1
            console.log('[NotificationBell] Unread count changed:', prevCount, '->', newCount)
            return newCount
          })
        }
        
        return updated
      } else {
        // Add new notification at the beginning
        console.log('[NotificationBell] Adding new notification, isRead:', notification.isRead)
        if (!notification.isRead) {
          setUnreadCount((prevCount) => {
            const newCount = prevCount + 1
            console.log('[NotificationBell] Incrementing unread count:', prevCount, '->', newCount)
            return newCount
          })
        }
        return [notification, ...prev]
      }
    })
    
    onNewNotification?.(notification)
  }, [onNewNotification, showUnreadOnly])

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
        <div className="px-4 py-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {showUnreadOnly 
                  ? `${notifications.length} unread` 
                  : `${notifications.length} total (${unreadCount} unread)`
                }
              </p>
            </div>
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUnreadOnly(false)}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                !showUnreadOnly
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setShowUnreadOnly(true)}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                showUnreadOnly
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread only
            </button>
          </div>
        </div>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="max-h-[400px] overflow-y-auto"
        >
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
                <div
                  key={notification.id}
                  className={`border-b transition-colors ${
                    !notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-2 px-4 py-3">
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className="flex-1 min-w-0 text-left group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm truncate group-hover:text-blue-600 transition-colors flex-1 ${
                          !notification.isRead ? 'font-semibold' : 'font-normal'
                        }`}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 animate-pulse" />
                        )}
                      </div>
                      <p className={`text-xs line-clamp-2 mb-1 ${
                        !notification.isRead ? 'text-gray-700' : 'text-gray-500'
                      }`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(notification.createdAt)}
                      </p>
                    </button>
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
                            setUnreadCount((prev) => Math.max(0, prev - 1))
                          } catch (error) {
                            console.error('Failed to mark notification as read:', error)
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0 px-2 self-start"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && page > 1 && (
                <div className="py-4 text-center text-sm text-gray-500">
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
