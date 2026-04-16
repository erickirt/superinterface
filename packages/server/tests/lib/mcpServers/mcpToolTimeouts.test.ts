import { test, mock } from 'node:test'
import type { MockModuleOptions } from 'node:test'
import assert from 'node:assert'
import type OpenAI from 'openai'
import {
  ModelProviderType,
  ToolType,
  type PrismaClient,
  type Thread,
} from '@prisma/client'

type HandleComputerCallParams = Parameters<
  typeof import('@/lib/computerCalls/handleComputerCall').handleComputerCall
>[0]
type HandleFunctionParams = Parameters<
  typeof import('@/lib/functions/handleFunction').handleFunction
>[0]

type Assistant = HandleComputerCallParams['assistant']
type FunctionAssistant = HandleFunctionParams['assistant']
type ToolCall = OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall

const connectErrorMessage =
  'fetch failed Connect Timeout Error (attempted address: computer-3.superstream.sh:443, timeout: 10000ms)'

const connectMcpServerMock: MockModuleOptions = {
  namedExports: {
    connectMcpServer: async () => {
      throw new Error(connectErrorMessage)
    },
  },
}

const createLogCalls: Array<{ log: { message: string } }> = []
const createLogMock: MockModuleOptions = {
  namedExports: {
    createLog: (args: { log: { message: string } }) => {
      createLogCalls.push(args)
    },
  },
}

mock.module('@/lib/mcpServers/connectMcpServer', connectMcpServerMock)
mock.module('@/lib/logs/createLog', createLogMock)

const { handleComputerCall } = await import(
  '@/lib/computerCalls/handleComputerCall'
)
const { handleFunction } = await import('@/lib/functions/handleFunction')

test('handleComputerCall returns MCP timeout errors as tool output', async () => {
  createLogCalls.length = 0

  const assistant = {
    id: 'assistant-id',
    workspaceId: 'workspace-id',
    modelProvider: {
      type: ModelProviderType.OPENAI,
    },
    tools: [
      {
        type: ToolType.COMPUTER_USE,
        computerUseTool: {
          mcpServer: { id: 'mcp-id' },
        },
      },
    ],
  } as unknown as Assistant

  const toolCall = {
    id: 'tool-call-id',
    computer_call: {
      action: { type: 'click', x: 1, y: 2 },
      pending_safety_checks: [],
    },
  } as unknown as ToolCall

  const thread = { id: 'thread-id' } as unknown as Thread

  const result = await handleComputerCall({
    assistant,
    toolCall,
    thread,
    prisma: {} as unknown as PrismaClient,
  })

  assert.strictEqual(result.tool_call_id, toolCall.id)
  assert.ok(typeof result.output === 'string')
  assert.ok(result.output.includes(connectErrorMessage))
  assert.ok(createLogCalls.length > 0)
})

test('handleFunction returns MCP timeout errors as tool output', async () => {
  createLogCalls.length = 0

  const assistant = {
    id: 'assistant-id',
    workspaceId: 'workspace-id',
    mcpServers: [{ id: 'mcp-id' }],
    functions: [],
  } as unknown as FunctionAssistant

  const toolCall = {
    id: 'tool-call-id',
    function: {
      name: 'remote.tool',
      arguments: '{}',
    },
  } as unknown as ToolCall

  const result = await handleFunction({
    assistant,
    toolCall,
    controller: {} as unknown as ReadableStreamDefaultController,
    run: {} as unknown as OpenAI.Beta.Threads.Runs.Run,
    thread: { id: 'thread-id' } as unknown as Thread,
    prisma: {} as unknown as PrismaClient,
  })

  assert.strictEqual(result.tool_call_id, toolCall.id)
  assert.ok(typeof result.output === 'string')
  assert.ok(result.output.includes(connectErrorMessage))
  assert.ok(createLogCalls.length > 0)
})
