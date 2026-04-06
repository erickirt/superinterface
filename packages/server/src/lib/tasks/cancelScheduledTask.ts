import { type Task } from '@prisma/client'
import type { TaskScheduler } from './schedulers/types'

export const cancelScheduledTask = async ({
  task,
  scheduler,
}: {
  task: Task
  scheduler: TaskScheduler
}) => {
  if (!task.qstashMessageId) return

  try {
    await scheduler.messages.delete(task.qstashMessageId)
  } catch (error) {
    console.error('Failed to cancel scheduled task:', error)
  }
}
