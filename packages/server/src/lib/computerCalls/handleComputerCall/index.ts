import OpenAI from 'openai'
import {
  ModelProviderType,
  Prisma,
  Thread,
  LogRequestMethod,
  LogRequestRoute,
  LogLevel,
  ToolType,
  type PrismaClient,
} from '@prisma/client'
import { createLog } from '@/lib/logs/createLog'
import { closeMcpConnection } from '@/lib/mcpServers/closeMcpConnection'
import {
  CallToolResultSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js'
import { connectMcpServer } from '@/lib/mcpServers/connectMcpServer'
import type { McpConnection } from '@/types'
import { getComputerCallActions } from '@/lib/computerCalls/getComputerCallActions'

const getContent = ({
  mcpServerToolOutput,
}: {
  mcpServerToolOutput: CallToolResult
}) => mcpServerToolOutput.content.find((c) => c.type === 'image')

const getImageUrl = ({
  mcpServerToolOutput,
}: {
  mcpServerToolOutput: CallToolResult
}) => {
  const content = getContent({ mcpServerToolOutput })
  if (!content) return null

  return `data:${content.mimeType};base64,${content.data}`
}

const serializeOutput = ({
  assistant,
  imageUrl,
}: {
  assistant: Prisma.AssistantGetPayload<{
    include: {
      modelProvider: true
    }
  }>
  imageUrl: string
}) => {
  if (assistant.modelProvider.type === ModelProviderType.ANTHROPIC) {
    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: imageUrl.split(',')[1],
        },
      },
    ]
  }

  return JSON.stringify({
    type: 'computer_screenshot',
    image_url: imageUrl,
  })
}

export const handleComputerCall = async ({
  assistant,
  toolCall,
  thread,
  prisma,
}: {
  assistant: Prisma.AssistantGetPayload<{
    include: {
      modelProvider: true
      tools: {
        include: {
          computerUseTool: {
            include: {
              mcpServer: {
                include: {
                  stdioTransport: true
                  sseTransport: true
                  httpTransport: true
                }
              }
            }
          }
        }
      }
    }
  }>
  toolCall: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall
  thread: Thread
  prisma: PrismaClient
}) => {
  const tool = assistant.tools.find(
    (tool) => tool.type === ToolType.COMPUTER_USE,
  )

  if (!tool || !tool.computerUseTool || !tool.computerUseTool.mcpServer) {
    createLog({
      log: {
        requestMethod: LogRequestMethod.POST,
        requestRoute: LogRequestRoute.MESSAGES,
        level: LogLevel.ERROR,
        status: 500,
        message: 'No computer use tool configured.',
        workspaceId: assistant.workspaceId,
        assistantId: assistant.id,
        threadId: thread.id,
      },
      prisma,
    })

    return {
      tool_call_id: toolCall.id,
      output: 'No computer use tool configured.',
    }
  }

  const { actions, acknowledgedSafetyChecks } = getComputerCallActions({
    toolCall,
  })

  if (actions.length === 0) {
    return {
      tool_call_id: toolCall.id,
      output: 'No computer actions provided.',
    }
  }

  const rawAction = actions.length === 1 ? actions[0] : actions

  let mcpConnection: McpConnection | null = null
  try {
    const connection = await connectMcpServer({
      thread,
      assistant,
      mcpServer: tool.computerUseTool.mcpServer,
      prisma,
    })
    mcpConnection = connection.mcpConnection

    let mcpServerToolOutput: CallToolResult | null = null

    for (const action of actions) {
      mcpServerToolOutput = (await mcpConnection.client.callTool(
        {
          name: 'computer_call',
          arguments: { action },
        },
        CallToolResultSchema,
        {
          timeout: 300000,
        },
      )) as CallToolResult
    }

    if (!mcpServerToolOutput) {
      throw new Error('No computer output returned.')
    }

    const imageUrl = getImageUrl({
      mcpServerToolOutput,
    })

    if (!imageUrl) {
      const screenshotOutput = (await mcpConnection.client.callTool(
        {
          name: 'computer_call',
          arguments: {
            action: { type: 'screenshot' },
          },
        },
        CallToolResultSchema,
        {
          timeout: 300000,
        },
      )) as CallToolResult

      const screenshotUrl = getImageUrl({
        mcpServerToolOutput: screenshotOutput,
      })

      if (screenshotUrl) {
        return {
          tool_call_id: toolCall.id,
          output: serializeOutput({
            imageUrl: screenshotUrl,
            assistant,
          }),
          acknowledged_safety_checks: acknowledgedSafetyChecks,
        }
      }

      return {
        tool_call_id: toolCall.id,
        output:
          mcpServerToolOutput.structuredContent ??
          mcpServerToolOutput.content ??
          '',
        acknowledged_safety_checks: acknowledgedSafetyChecks,
      }
    }

    return {
      tool_call_id: toolCall.id,
      output: serializeOutput({
        imageUrl,
        assistant,
      }),
      acknowledged_safety_checks: acknowledgedSafetyChecks,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    const message = e instanceof Error ? e.message : String(e)
    createLog({
      log: {
        requestMethod: LogRequestMethod.POST,
        requestRoute: LogRequestRoute.MESSAGES,
        level: LogLevel.ERROR,
        status: 500,
        message: `Error calling computer_call with action ${JSON.stringify(rawAction)}: ${message}`,
        workspaceId: assistant.workspaceId,
        assistantId: assistant.id,
        threadId: thread.id,
      },
      prisma,
    })

    return {
      tool_call_id: toolCall.id,
      output: `Error calling computer_call with action ${JSON.stringify(rawAction)}: ${message}`,
    }
  } finally {
    if (mcpConnection) {
      try {
        await closeMcpConnection({
          mcpConnection,
        })
      } catch {
        // Ignore close errors so the tool output is still returned.
      }
    }
  }
}
