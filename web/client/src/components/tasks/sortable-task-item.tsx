'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Calendar, User, Trash2, BookOpen, ListTodo, CheckSquare } from 'lucide-react'
import { Task } from '@/lib/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface SortableTaskItemProps {
  task: Task
  onTaskClick: (task: Task) => void
  onDeleteTask: (task: Task) => void
  disabled?: boolean
  isSubTask?: boolean
}

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  open: 'info',
  in_progress: 'warning',
  completed: 'success',
  blocked: 'danger',
  cancelled: 'default',
}

const PRIORITY_COLORS: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
}

const TYPE_ICONS = {
  story: BookOpen,
  task: CheckSquare,
  'sub-task': ListTodo,
}

export function SortableTaskItem({
  task,
  onTaskClick,
  onDeleteTask,
  disabled,
  isSubTask,
}: SortableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const TypeIcon = TYPE_ICONS[task.type] || CheckSquare

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm
        hover:border-slate-300 hover:shadow-md transition-all
        ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}
        ${isSubTask ? 'border-slate-200' : 'border-slate-300'}
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors"
        disabled={disabled}
      >
        <GripVertical className="size-5" />
      </button>

      {/* Type Icon */}
      <div className={`${isSubTask ? 'text-slate-400' : 'text-slate-600'}`}>
        <TypeIcon className="size-5" />
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onTaskClick(task)}
          className="w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={`font-medium truncate ${
                isSubTask ? 'text-sm text-slate-700' : 'text-slate-900'
              }`}
            >
              {task.title}
            </h4>
            <Badge tone={STATUS_COLORS[task.status] || 'default'}>
              {task.status.replace('_', ' ')}
            </Badge>
            <Badge tone={PRIORITY_COLORS[task.priority] || 'default'}>
              {task.priority}
            </Badge>
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            {task.assignee && (
              <div className="flex items-center gap-1">
                <User className="size-3" />
                <span>
                  {task.assignee.firstName} {task.assignee.lastName}
                </span>
              </div>
            )}
            {task.dueAt && (
              <div className="flex items-center gap-1">
                <Calendar className="size-3" />
                <span>{new Date(task.dueAt).toLocaleDateString()}</span>
              </div>
            )}
            {task.type === 'story' && task.subTasks && task.subTasks.length > 0 && (
              <div className="flex items-center gap-1">
                <ListTodo className="size-3" />
                <span>{task.subTasks.length} sub-tasks</span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onDeleteTask(task)
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
