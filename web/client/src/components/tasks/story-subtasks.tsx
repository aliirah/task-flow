'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, GripVertical, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { taskApi } from '@/lib/api'
import { Task } from '@/lib/types/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface SubTaskItemProps {
  task: Task
  onDelete: (id: string) => void
  isEditing: boolean
  editValue: string
  onEditValueChange: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
}

function SubTaskItem({
  task,
  onDelete,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: SubTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onSaveEdit()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  onCancelEdit()
                }
              }}
              className="h-8 text-sm"
              placeholder="Sub-task title"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={onSaveEdit}
              className="h-8 w-8 p-0"
            >
              <Check className="size-4 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelEdit}
              className="h-8 w-8 p-0"
            >
              <X className="size-4 text-slate-500" />
            </Button>
          </div>
        ) : (
          <button
            onClick={onStartEdit}
            className="w-full text-left text-sm font-medium text-slate-900 hover:text-slate-700"
          >
            {task.title}
          </button>
        )}
        <div className="mt-1 flex items-center gap-2">
          <Badge
            tone={
              task.status === 'completed'
                ? 'success'
                : task.status === 'blocked'
                  ? 'danger'
                  : 'info'
            }
            className="text-xs"
          >
            {task.status}
          </Badge>
          <Badge
            tone={
              task.priority === 'critical'
                ? 'danger'
                : task.priority === 'high'
                  ? 'warning'
                  : task.priority === 'medium'
                    ? 'info'
                    : 'default'
            }
            className="text-xs"
          >
            {task.priority}
          </Badge>
        </div>
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

interface StorySubTasksProps {
  storyId: string
  organizationId: string
}

export function StorySubTasks({ storyId, organizationId }: StorySubTasksProps) {
  const [subTasks, setSubTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const loadSubTasks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await taskApi.list({
        organizationId,
        sortBy: 'displayOrder',
        sortOrder: 'asc',
      })
      const allTasks = response.data?.items ?? []
      const filtered = allTasks.filter((t) => t.parentTaskId === storyId)
      setSubTasks(filtered)
    } catch (error) {
      handleApiError({ error })
    } finally {
      setLoading(false)
    }
  }, [storyId, organizationId])

  useEffect(() => {
    loadSubTasks()
  }, [loadSubTasks])

  const handleCreate = async () => {
    if (!newTaskTitle.trim()) {
      toast.error('Please enter a title')
      return
    }

    setCreating(true)
    try {
      const payload = {
        title: newTaskTitle.trim(),
        organizationId,
        parentTaskId: storyId,
        type: 'sub-task',
        status: 'open',
        priority: 'medium',
        displayOrder: subTasks.length,
      }
      console.log('[StorySubTasks] Creating subtask with payload:', payload)
      const response = await taskApi.create(payload)
      setSubTasks((prev) => [...prev, response.data])
      setNewTaskTitle('')
      toast.success('Sub-task created')
    } catch (error) {
      handleApiError({ error })
    } finally {
      setCreating(false)
    }
  }

  const handleStartEdit = (task: Task) => {
    setEditingTaskId(task.id)
    setEditValue(task.title)
  }

  const handleCancelEdit = () => {
    setEditingTaskId(null)
    setEditValue('')
  }

  const handleSaveEdit = async () => {
    if (!editingTaskId || !editValue.trim()) {
      toast.error('Please enter a title')
      return
    }

    try {
      await taskApi.update(editingTaskId, {
        title: editValue.trim(),
      })
      setSubTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskId ? { ...t, title: editValue.trim() } : t
        )
      )
      setEditingTaskId(null)
      setEditValue('')
      toast.success('Sub-task updated')
    } catch (error) {
      handleApiError({ error })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sub-task?')) return

    try {
      await taskApi.remove(id)
      setSubTasks((prev) => prev.filter((t) => t.id !== id))
      toast.success('Sub-task deleted')
    } catch (error) {
      handleApiError({ error })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = subTasks.findIndex((t) => t.id === active.id)
    const newIndex = subTasks.findIndex((t) => t.id === over.id)

    const reordered = arrayMove(subTasks, oldIndex, newIndex)
    setSubTasks(reordered)

    const updates = reordered.map((task, index) => ({
      id: task.id,
      displayOrder: index,
    }))

    try {
      await taskApi.reorder({
        organizationId,
        tasks: updates,
      })
      toast.success('Sub-tasks reordered')
    } catch (error) {
      handleApiError({ error })
      // Revert on error
      setSubTasks(subTasks)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Loading sub-tasks...</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Sub-tasks ({subTasks.length})
        </h3>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {subTasks.map((task) => (
              <SubTaskItem
                key={task.id}
                task={task}
                onDelete={handleDelete}
                isEditing={editingTaskId === task.id}
                editValue={editValue}
                onEditValueChange={setEditValue}
                onStartEdit={() => handleStartEdit(task)}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {subTasks.length === 0 && (
        <p className="mb-4 text-sm text-slate-500">
          No sub-tasks yet. Add one below.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreate()
            }
          }}
          placeholder="Add a sub-task..."
          className="flex-1 text-sm"
          disabled={creating}
        />
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || !newTaskTitle.trim()}
          className="gap-2"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  )
}
