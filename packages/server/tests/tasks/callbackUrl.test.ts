import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { scheduleTask } from '../../src/lib/tasks/scheduleTask'
import type { TaskScheduler } from '../../src/lib/tasks/schedulers/types'
import type { Task } from '@prisma/client'

// ---- helpers ----

const createRecordingScheduler = () => {
  const published: Array<{
    url: string
    body: Record<string, unknown>
    delay: number
    messageId: string
  }> = []
  const deleted: string[] = []

  const scheduler: TaskScheduler = {
    publishJSON: async (opts) => {
      const messageId = randomUUID()
      published.push({ ...opts, messageId })
      return { messageId }
    },
    messages: {
      delete: async (messageId) => {
        deleted.push(messageId)
      },
    },
  }

  return { scheduler, published, deleted }
}

const createMockPrisma = () => {
  const updates: Array<{
    where: { id: string }
    data: { qstashMessageId: string }
  }> = []

  return {
    updates,
    prisma: {
      task: {
        update: async (args: any) => {
          updates.push(args)
          return args
        },
      },
    } as any,
  }
}

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: randomUUID(),
    title: 'Test task',
    message: 'Test message',
    schedule: { start: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
    key: '',
    qstashMessageId: null,
    threadId: randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Task

// ---- tests ----

describe('scheduleTask callbackUrl', () => {
  let recording: ReturnType<typeof createRecordingScheduler>
  let mockDb: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    recording = createRecordingScheduler()
    mockDb = createMockPrisma()
  })

  it('uses callbackUrl when provided', async () => {
    const task = makeTask()
    const customUrl = 'http://localhost:4000/superinterface/api/tasks/callback'

    await scheduleTask({
      task,
      prisma: mockDb.prisma,
      scheduler: recording.scheduler,
      callbackUrl: customUrl,
    })

    assert.equal(recording.published.length, 1)
    assert.equal(recording.published[0].url, customUrl)
  })

  it('falls back to env-based url when callbackUrl is not provided', async () => {
    const origEnv = process.env.NEXT_PUBLIC_SUPERINTERFACE_BASE_URL
    process.env.NEXT_PUBLIC_SUPERINTERFACE_BASE_URL = 'https://my-app.com'

    try {
      const task = makeTask()
      await scheduleTask({
        task,
        prisma: mockDb.prisma,
        scheduler: recording.scheduler,
      })

      assert.equal(recording.published.length, 1)
      assert.equal(
        recording.published[0].url,
        'https://my-app.com/api/cloud/tasks/callback',
      )
    } finally {
      if (origEnv === undefined) {
        delete process.env.NEXT_PUBLIC_SUPERINTERFACE_BASE_URL
      } else {
        process.env.NEXT_PUBLIC_SUPERINTERFACE_BASE_URL = origEnv
      }
    }
  })

  it('passes callbackUrl through for continuous task with delay 0', async () => {
    const task = makeTask({
      schedule: {
        start: new Date(Date.now() - 60 * 1000).toISOString(),
        duration: 'P10Y',
      } as any,
    })
    const customUrl = 'http://localhost:3000/superinterface/api/tasks/callback'

    await scheduleTask({
      task,
      prisma: mockDb.prisma,
      scheduler: recording.scheduler,
      callbackUrl: customUrl,
    })

    assert.equal(recording.published.length, 1)
    assert.equal(recording.published[0].url, customUrl)
    assert.equal(recording.published[0].delay, 0)
  })

  it('passes callbackUrl through for future scheduled task', async () => {
    const customUrl = 'http://my-host:8080/tasks/callback'
    const task = makeTask({
      schedule: {
        start: new Date(Date.now() + 300 * 1000).toISOString(),
      } as any,
    })

    await scheduleTask({
      task,
      prisma: mockDb.prisma,
      scheduler: recording.scheduler,
      callbackUrl: customUrl,
    })

    assert.equal(recording.published.length, 1)
    assert.equal(recording.published[0].url, customUrl)
    assert.ok(recording.published[0].delay >= 298)
    assert.ok(recording.published[0].delay <= 302)
  })

  it('passes callbackUrl through for recurring task', async () => {
    const customUrl = 'http://localhost:3000/superinterface/api/tasks/callback'
    const task = makeTask({
      schedule: {
        start: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        recurrenceRules: [{ frequency: 'hourly' }],
      } as any,
    })

    await scheduleTask({
      task,
      prisma: mockDb.prisma,
      scheduler: recording.scheduler,
      callbackUrl: customUrl,
    })

    assert.equal(recording.published.length, 1)
    assert.equal(recording.published[0].url, customUrl)
  })

  it('stores messageId in database regardless of callbackUrl', async () => {
    const task = makeTask()
    const customUrl = 'http://custom-host/callback'

    await scheduleTask({
      task,
      prisma: mockDb.prisma,
      scheduler: recording.scheduler,
      callbackUrl: customUrl,
    })

    assert.equal(mockDb.updates.length, 1)
    assert.equal(mockDb.updates[0].where.id, task.id)
    assert.equal(
      mockDb.updates[0].data.qstashMessageId,
      recording.published[0].messageId,
    )
  })

  it('does nothing when schedule has no next occurrence even with callbackUrl', async () => {
    const task = makeTask({
      schedule: {
        start: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      } as any,
    })

    await scheduleTask({
      task,
      prisma: mockDb.prisma,
      scheduler: recording.scheduler,
      callbackUrl: 'http://localhost:3000/callback',
    })

    assert.equal(recording.published.length, 0)
    assert.equal(mockDb.updates.length, 0)
  })
})
