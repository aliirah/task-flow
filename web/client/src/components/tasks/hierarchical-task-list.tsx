'use client'

import { useState, useMemo } from 'react'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Task } from '@/lib/types/api'
import { SortableTaskItem } from './sortable-task-item'
import { taskApi } from '@/lib/api'
import { handleApiError } from '@/lib/utils/error-handler'
import { toast } from 'sonner'

interface HierarchicalTaskListProps {
  tasks: Task[]
  onTasksChange: (tasks: Task[]) => void
  onTaskClick: (task: Task) => void
  onDeleteTask: (task: Task) => void
  organizationId: string
}

export function HierarchicalTaskList({
  tasks,
  onTasksChange,
  onTaskClick,
  onDeleteTask,
  organizationId,
}: HierarchicalTaskListProps) {
  const [reordering, setReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Organize tasks into hierarchical structure
  const { stories, standaloneTasks, taskMap } = useMemo(() => {
    const map = new Map<string, Task>()
    const storyList: Task[] = []
    const standaloneList: Task[] = []

    // First pass: create map and identify stories
    tasks.forEach((task) => {
      map.set(task.id, { ...task, subTasks: [] })
      if (task.type === 'story') {
        storyList.push(task)
      } else if (!task.parentTaskId) {
        standaloneList.push(task)
      }
    })

    // Second pass: attach sub-tasks to their parents
    tasks.forEach((task) => {
      if (task.parentTaskId) {
        const parent = map.get(task.parentTaskId)
        if (parent) {
          if (!parent.subTasks) parent.subTasks = []
          parent.subTasks.push(task)
        }
      }
    })

    // Sort stories and standalone tasks by displayOrder
    storyList.sort((a, b) => a.displayOrder - b.displayOrder)
    standaloneList.sort((a, b) => a.displayOrder - b.displayOrder)

    // Sort sub-tasks within each story
    storyList.forEach((story) => {
      const storyWithSubtasks = map.get(story.id)
      if (storyWithSubtasks?.subTasks) {
        storyWithSubtasks.subTasks.sort((a, b) => a.displayOrder - b.displayOrder)
      }
    })

    return {
      stories: storyList.map((s) => map.get(s.id)!),
      standaloneTasks: standaloneList,
      taskMap: map,
    }
  }, [tasks])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = taskMap.get(activeId)
    const overTask = taskMap.get(overId)

    if (!activeTask || !overTask) return

    // Don't allow reordering between different contexts
    // Stories can only be reordered with other stories
    // Sub-tasks can only be reordered within the same story
    // Standalone tasks can only be reordered with other standalone tasks
    if (activeTask.type === 'story' && overTask.type !== 'story') return
    if (activeTask.type === 'sub-task' && activeTask.parentTaskId !== overTask.parentTaskId) return
    if (
      activeTask.type === 'task' &&
      !activeTask.parentTaskId &&
      (overTask.type === 'story' || overTask.parentTaskId)
    )
      return

    let newTasks: Task[]

    if (activeTask.type === 'story') {
      const oldIndex = stories.findIndex((s) => s.id === activeId)
      const newIndex = stories.findIndex((s) => s.id === overId)
      newTasks = arrayMove(stories, oldIndex, newIndex)
    } else if (activeTask.parentTaskId) {
      // Reordering sub-tasks within a story
      const parent = taskMap.get(activeTask.parentTaskId)
      if (!parent?.subTasks) return
      const oldIndex = parent.subTasks.findIndex((s) => s.id === activeId)
      const newIndex = parent.subTasks.findIndex((s) => s.id === overId)
      newTasks = arrayMove(parent.subTasks, oldIndex, newIndex)
    } else {
      // Reordering standalone tasks
      const oldIndex = standaloneTasks.findIndex((s) => s.id === activeId)
      const newIndex = standaloneTasks.findIndex((s) => s.id === overId)
      newTasks = arrayMove(standaloneTasks, oldIndex, newIndex)
    }

    // Update display order
    const updates = newTasks.map((task, index) => ({
      id: task.id,
      displayOrder: index,
    }))

    // Optimistically update local state
    const updatedTasks = tasks.map((task) => {
      const update = updates.find((u) => u.id === task.id)
      if (update) {
        return { ...task, displayOrder: update.displayOrder }
      }
      return task
    })
    onTasksChange(updatedTasks)

    // Send to backend
    setReordering(true)
    try {
      await taskApi.reorder({
        organizationId,
        tasks: updates,
      })
      toast.success('Tasks reordered')
    } catch (error) {
      handleApiError({ error })
      // Revert on error
      onTasksChange(tasks)
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stories Section */}
      {stories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            Stories
          </h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={stories.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {stories.map((story) => (
                  <div key={story.id} className="space-y-1">
                    <SortableTaskItem
                      task={story}
                      onTaskClick={onTaskClick}
                      onDeleteTask={onDeleteTask}
                      disabled={reordering}
                    />
                    {story.subTasks && story.subTasks.length > 0 && (
                      <div className="ml-8 space-y-1">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={story.subTasks.map((st) => st.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {story.subTasks.map((subTask) => (
                              <SortableTaskItem
                                key={subTask.id}
                                task={subTask}
                                onTaskClick={onTaskClick}
                                onDeleteTask={onDeleteTask}
                                disabled={reordering}
                                isSubTask
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Standalone Tasks Section */}
      {standaloneTasks.length > 0 && (
        <div className="space-y-3">
          {stories.length > 0 && (
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              Tasks
            </h3>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={standaloneTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {standaloneTasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onTaskClick={onTaskClick}
                    onDeleteTask={onDeleteTask}
                    disabled={reordering}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {stories.length === 0 && standaloneTasks.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No tasks found. Create a new task to get started.
        </div>
      )}
    </div>
  )
}
