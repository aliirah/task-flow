'use client'

import { createContext, useContext, useEffect } from 'react'

import type { TaskEventMessage } from '@/lib/types/ws'

export type TaskEventListener = (event: TaskEventMessage) => void

export const TaskEventContext = createContext<{
  subscribe: (listener: TaskEventListener) => () => void
} | null>(null)

export function useTaskEvents(listener: TaskEventListener | null) {
  const ctx = useContext(TaskEventContext)
  useEffect(() => {
    if (!ctx || !listener) {
      return
    }
    return ctx.subscribe(listener)
  }, [ctx, listener])
}
