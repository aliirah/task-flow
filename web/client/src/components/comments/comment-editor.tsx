'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance as TippyInstance } from 'tippy.js'
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

interface MentionListProps {
  items: User[]
  command: (item: { id: string; label: string }) => void
}

const MentionList = forwardRef<any, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const itemsLength = props.items.length
    if (selectedIndex >= itemsLength && itemsLength > 0) {
      queueMicrotask(() => setSelectedIndex(0))
    }
  }, [props.items, selectedIndex])

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command({
        id: item.id,
        label: `${item.firstName} ${item.lastName}`,
      })
    }
  }

  const upHandler = () => {
    setSelectedIndex((i) => (i <= 0 ? props.items.length - 1 : i - 1))
  }

  const downHandler = () => {
    setSelectedIndex((i) => (i >= props.items.length - 1 ? 0 : i + 1))
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter') {
        enterHandler()
        return true
      }

      return false
    },
  }))

  return (
    <div className="mentions-dropdown rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto z-100">
      {props.items.length > 0 ? (
        props.items.map((user, index) => (
          <button
            key={user.id}
            type="button"
            onClick={() => selectItem(index)}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
              index === selectedIndex
                ? 'bg-blue-50 text-blue-900'
                : 'text-slate-700 hover:bg-slate-50'
            )}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-600 text-[11px] font-semibold text-white">
              {user.firstName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate font-medium text-sm">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-slate-500">No users found</div>
      )}
    </div>
  )
})

MentionList.displayName = 'MentionList'

export function CommentEditor({
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  initialContent = '',
  autoFocus = false,
  submitLabel = 'Comment',
  users,
}: CommentEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])

  const editor = useEditor(
    {
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
        Mention.configure({
          HTMLAttributes: {
            class: 'mention',
          },
          suggestion: {
            items: ({ query }) => {
              // If no query, show all users (max 10)
              if (!query || query.trim() === '') {
                return users.slice(0, 10)
              }
              
              // Filter users by query
              return users
                .filter((user) => {
                  const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
                  const email = user.email.toLowerCase()
                  const q = query.toLowerCase()
                  return fullName.includes(q) || email.includes(q)
                })
                .slice(0, 10)
            },
          render: () => {
            let component: ReactRenderer<any>
            let popup: TippyInstance[]

            return {
              onStart: (props) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                })

                if (!props.clientRect) {
                  return
                }

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as any,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  zIndex: 9999,
                })
              },

              onUpdate(props) {
                component.updateProps(props)

                if (!props.clientRect) {
                  return
                }

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect as any,
                })
              },

              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide()
                  return true
                }

                return component.ref?.onKeyDown(props)
              },

              onExit() {
                popup[0].destroy()
                component.destroy()
              },
            }
          },
        },
      }),
    ],
    content: initialContent,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[60px] p-2.5 text-sm',
      },
    },
    onCreate: ({ editor }) => {
      if (initialContent) {
        editor.commands.setContent(initialContent)
        setIsEmpty(false)
      }
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      setIsEmpty(!text.trim())
      
      // Extract mentioned user IDs from the content
      const doc = editor.getJSON()
      const mentions: string[] = []
      
      const extractMentions = (node: any) => {
        if (node.type === 'mention' && node.attrs?.id) {
          mentions.push(node.attrs.id)
        }
        if (node.content) {
          node.content.forEach((child: any) => extractMentions(child))
        }
      }
      
      extractMentions(doc)
      setMentionedUserIds(Array.from(new Set(mentions)))
    },
  },
  [users])

  const handleSubmit = async () => {
    if (!editor) return

    const html = editor.getHTML()
    const text = editor.getText()

    if (!text.trim() || text.trim().length === 0) return

    setIsSubmitting(true)
    try {
      await onSubmit(html, mentionedUserIds)
      editor.commands.clearContent()
      setMentionedUserIds([])
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
        
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-1.5 bg-slate-50/50">
          <div className="text-[11px] text-slate-500">
            <kbd className="px-1 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">⌘</kbd> + <kbd className="px-1 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">Enter</kbd>
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
