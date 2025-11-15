'use client'

import { createContext, useContext, useEffect } from 'react'

import type { CommentEventMessage } from '@/lib/types/ws'

export type CommentEventListener = (event: CommentEventMessage) => void

export const CommentEventContext = createContext<{
  subscribe: (listener: CommentEventListener) => () => void
} | null>(null)

export function useCommentEvents(listener: CommentEventListener | null) {
  const ctx = useContext(CommentEventContext)
  useEffect(() => {
    if (!ctx || !listener) {
      return
    }
    return ctx.subscribe(listener)
  }, [ctx, listener])
}
