'use client'

import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { User } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { Send, Bold, Italic, List, ListOrdered, Code } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommentEditorProps {
  onSubmit: (content: string, mentionedUsers: string[]) => Promise<void>
  onCancel?: () => void
  placeholder?: string
  initialContent?: string
  initialMentions?: string[]
  autoFocus?: boolean
  users: User[]
  submitLabel?: string
}

export function CommentEditor({
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  initialContent = '',
  autoFocus = false,
  submitLabel = 'Comment',
}: CommentEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px] p-3 text-sm',
      },
    },
    onCreate: ({ editor }) => {
      // Ensure editor is not considered empty if we have initial content
      if (initialContent) {
        editor.commands.setContent(initialContent)
        setIsEmpty(false)
      }
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      setIsEmpty(!text.trim())
    },
  })

  const handleSubmit = async () => {
    if (!editor) return

    const html = editor.getHTML()
    const text = editor.getText()

    if (!text.trim() || text.trim().length === 0) return

    setIsSubmitting(true)
    try {
      await onSubmit(html, [])
      editor.commands.clearContent()
      editor.commands.focus()
    } catch (error) {
      console.error('Failed to submit comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!editor) {
    return null
  }

  return (
    <div className="w-full">
      <div
        className="rounded-lg border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all"
        onKeyDown={handleKeyDown}
      >
        {/* Formatting Toolbar */}
        <div className="flex items-center gap-0.5 border-b border-slate-100 px-2 py-1.5 bg-slate-50/50">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'p-1.5 rounded hover:bg-slate-200 transition-colors',
              editor.isActive('bold') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
            )}
            title="Bold (⌘B)"
          >
            <Bold className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'p-1.5 rounded hover:bg-slate-200 transition-colors',
              editor.isActive('italic') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
            )}
            title="Italic (⌘I)"
          >
            <Italic className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'p-1.5 rounded hover:bg-slate-200 transition-colors',
              editor.isActive('bulletList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
            )}
            title="Bullet List"
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'p-1.5 rounded hover:bg-slate-200 transition-colors',
              editor.isActive('orderedList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
            )}
            title="Numbered List"
          >
            <ListOrdered className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              'p-1.5 rounded hover:bg-slate-200 transition-colors',
              editor.isActive('code') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'
            )}
            title="Inline Code"
          >
            <Code className="size-4" />
          </button>
        </div>

        <EditorContent editor={editor} />
        
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 bg-slate-50/50">
          <div className="text-xs text-slate-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">Enter</kbd> to submit
          </div>
          
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || isEmpty}
            >
              {isSubmitting ? (
                'Posting...'
              ) : (
                <>
                  <Send className="size-3.5 mr-1.5" />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
