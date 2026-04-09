import { describe, test, expect, vi } from 'vitest'
import { createMessageResponse } from './index'

const createMockStream = (
  events: any[],
  errorAtIndex?: number,
  error?: Error,
) => ({
  [Symbol.asyncIterator]() {
    let i = 0
    return {
      async next() {
        if (errorAtIndex !== undefined && i === errorAtIndex && error) {
          i++
          throw error
        }
        if (i < events.length) {
          return { value: events[i++], done: false }
        }
        return { value: undefined, done: true }
      },
    }
  },
})

const consumeStream = async (stream: ReadableStream) => {
  const reader = stream.getReader()
  const chunks: string[] = []
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value))
    }
  } catch {
    // stream errored
  }
  return chunks.join('')
}

describe('createMessageResponse', () => {
  test('normal stream completes successfully', async () => {
    const events = [
      { event: 'thread.run.created', data: { id: 'run_1', status: 'queued' } },
      {
        event: 'thread.message.created',
        data: { id: 'msg_1', content: [], role: 'assistant', thread_id: 't1' },
      },
      {
        event: 'thread.message.completed',
        data: {
          id: 'msg_1',
          content: [{ type: 'text', text: { value: 'Hi' } }],
          role: 'assistant',
          thread_id: 't1',
        },
      },
    ]

    const onClose = vi.fn()
    const onError = vi.fn()

    const stream = createMessageResponse({
      client: {},
      createRunStream: createMockStream(events),
      handleToolCall: vi.fn(),
      onClose,
      onError,
    })

    const output = await consumeStream(stream)
    expect(output).toContain('thread.message.completed')
    expect(onClose).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  test('JSON parse error (Azure keepalive) is skipped, stream continues', async () => {
    // Azure sends keepalive with empty data mid-stream — should skip and keep going
    const events = [
      { event: 'thread.run.created', data: { id: 'run_1', status: 'queued' } },
      {
        event: 'thread.message.created',
        data: { id: 'msg_1', content: [], role: 'assistant', thread_id: 't1' },
      },
      // keepalive error thrown at index 2 — mock skips one slot, so we need an extra event
      {
        event: 'thread.message.delta',
        data: {
          id: 'msg_1',
          delta: { content: [{ type: 'text', text: { value: 'Hello' } }] },
        },
      },
      {
        event: 'thread.message.completed',
        data: {
          id: 'msg_1',
          content: [{ type: 'text', text: { value: 'Hello' } }],
          role: 'assistant',
          thread_id: 't1',
        },
      },
    ]

    const jsonParseError = new SyntaxError('Unexpected end of JSON input')
    const onClose = vi.fn()
    const onError = vi.fn()

    const stream = createMessageResponse({
      client: {},
      createRunStream: createMockStream(events, 2, jsonParseError),
      handleToolCall: vi.fn(),
      onClose,
      onError,
    })

    const output = await consumeStream(stream)

    // Events after the keepalive should still be streamed
    expect(output).toContain('thread.message.completed')
    expect(onError).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  test('nested JSON parse error in cause is also skipped', async () => {
    const events = [
      { event: 'thread.run.created', data: { id: 'run_1', status: 'queued' } },
      // error thrown at index 1, skips one slot
      {
        event: 'thread.message.created',
        data: { id: 'msg_1', content: [], role: 'assistant', thread_id: 't1' },
      },
      {
        event: 'thread.message.completed',
        data: {
          id: 'msg_1',
          content: [{ type: 'text', text: { value: 'Done' } }],
          role: 'assistant',
          thread_id: 't1',
        },
      },
    ]

    const cause = new SyntaxError('Unexpected end of JSON input')
    const wrapper = new Error('Connection error.')
    ;(wrapper as any).cause = cause

    const onClose = vi.fn()
    const onError = vi.fn()

    const stream = createMessageResponse({
      client: {},
      createRunStream: createMockStream(events, 1, wrapper),
      handleToolCall: vi.fn(),
      onClose,
      onError,
    })

    const output = await consumeStream(stream)

    expect(output).toContain('thread.message.completed')
    expect(onError).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  test('real errors still propagate', async () => {
    const events = [
      { event: 'thread.run.created', data: { id: 'run_1', status: 'queued' } },
    ]

    const realError = new Error('Connection reset by peer')
    const onClose = vi.fn()
    const onError = vi.fn()

    const stream = createMessageResponse({
      client: {},
      createRunStream: createMockStream(events, 1, realError),
      handleToolCall: vi.fn(),
      onClose,
      onError,
    })

    await consumeStream(stream)

    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls[0][0].error).toBe(realError)
  })
})
