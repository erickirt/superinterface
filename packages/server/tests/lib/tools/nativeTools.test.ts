/**
 * Unit tests for `nativeTools()` — the helper inside
 * `@/lib/tools/tools/index.ts` that maps persisted Tool rows into the native
 * OpenAI-SDK tool shape the run loop ultimately sends to the model.
 *
 * Historical gap: nativeTools had explicit branches for ANTHROPIC /
 * OPEN_ROUTER / GOOGLE / OpenAI-Responses storage when emitting a
 * computer-use tool, but no branch for OLLAMA — so OLLAMA assistants fell
 * through to `return null` and the tool was silently stripped from the
 * outgoing request. That's the "I cannot see your computer screen" bug.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ModelProviderType,
  StorageProviderType,
  ToolType,
} from '@prisma/client'
import { nativeTools } from '@/lib/tools/tools'

// Minimal fixture factory for the shape `nativeTools` expects. `any`-casts
// avoid pulling in the entire Prisma include tree — we only care about the
// fields the function actually reads.
const buildAssistant = ({
  modelProviderType,
  storageProviderType = StorageProviderType.SUPERINTERFACE_CLOUD,
  tools = [],
}: {
  modelProviderType: ModelProviderType
  storageProviderType?: StorageProviderType
  tools?: any[]
}): any => ({
  id: 'assistant-id',
  workspaceId: 'workspace-id',
  storageProviderType,
  modelProvider: { type: modelProviderType },
  tools,
})

const computerUseTool = {
  id: 'tool-id',
  type: ToolType.COMPUTER_USE,
  computerUseTool: {
    mcpServerId: 'mcp-server-id',
    displayWidth: 1280,
    displayHeight: 720,
    environment: 'LINUX',
  },
}

describe('nativeTools — COMPUTER_USE', () => {
  it('emits computer_use_preview for OLLAMA (regression guard for the bug)', () => {
    const result = nativeTools({
      assistant: buildAssistant({
        modelProviderType: ModelProviderType.OLLAMA,
        tools: [computerUseTool],
      }),
      useOpenaiComputerTool: false,
    })

    assert.equal(
      result.length,
      1,
      'computer-use tool should not be stripped for OLLAMA',
    )
    assert.equal((result[0] as { type: string }).type, 'computer_use_preview')
  })

  it('emits computer_use_preview for OPEN_ROUTER', () => {
    const result = nativeTools({
      assistant: buildAssistant({
        modelProviderType: ModelProviderType.OPEN_ROUTER,
        tools: [computerUseTool],
      }),
      useOpenaiComputerTool: false,
    })

    assert.equal(result.length, 1)
    assert.equal((result[0] as { type: string }).type, 'computer_use_preview')
  })

  it('emits computer_use_preview for GOOGLE', () => {
    const result = nativeTools({
      assistant: buildAssistant({
        modelProviderType: ModelProviderType.GOOGLE,
        tools: [computerUseTool],
      }),
      useOpenaiComputerTool: false,
    })

    assert.equal(result.length, 1)
    assert.equal((result[0] as { type: string }).type, 'computer_use_preview')
  })

  it('emits the native Anthropic computer tool for ANTHROPIC', () => {
    const result = nativeTools({
      assistant: buildAssistant({
        modelProviderType: ModelProviderType.ANTHROPIC,
        tools: [computerUseTool],
      }),
      useOpenaiComputerTool: false,
    })

    assert.equal(result.length, 1)
    const tool = result[0] as {
      type: string
      computer_20250124: {
        name: string
        display_width_px: number
        display_height_px: number
      }
    }
    assert.equal(tool.type, 'computer_20250124')
    assert.equal(tool.computer_20250124.name, 'computer')
    assert.equal(tool.computer_20250124.display_width_px, 1280)
    assert.equal(tool.computer_20250124.display_height_px, 720)
  })

  it('emits the OpenAI Responses computer tool for OPENAI + OPENAI_RESPONSES', () => {
    const result = nativeTools({
      assistant: buildAssistant({
        modelProviderType: ModelProviderType.OPENAI,
        storageProviderType: StorageProviderType.OPENAI_RESPONSES,
        tools: [computerUseTool],
      }),
      // `useOpenaiComputerTool: true` would produce the GA `computer` shape;
      // false produces `computer_use_preview`. Either way, the storage-
      // provider branch fires before the model-provider branches and emits
      // a non-null tool — that's what we're asserting.
      useOpenaiComputerTool: false,
    })

    assert.equal(result.length, 1)
    assert.equal((result[0] as { type: string }).type, 'computer_use_preview')
  })

  it('drops the tool when mcpServerId is missing (regardless of provider)', () => {
    const toolWithoutMcp = {
      ...computerUseTool,
      computerUseTool: {
        ...computerUseTool.computerUseTool,
        mcpServerId: null,
      },
    }

    const result = nativeTools({
      assistant: buildAssistant({
        modelProviderType: ModelProviderType.OLLAMA,
        tools: [toolWithoutMcp],
      }),
      useOpenaiComputerTool: false,
    })

    assert.equal(result.length, 0, 'tool with no mcpServerId must be stripped')
  })

  it('emits nothing for an unhandled provider (e.g. GROQ) — negative control', () => {
    const result = nativeTools({
      assistant: buildAssistant({
        modelProviderType: ModelProviderType.GROQ,
        tools: [computerUseTool],
      }),
      useOpenaiComputerTool: false,
    })

    // GROQ doesn't support computer-use and shouldn't have been allowed here
    // by `isToolConfigAvailable` in the first place, but `nativeTools` is
    // defensive and falls through to null. This test pins that behaviour so
    // nobody accidentally "fixes" GROQ by adding it to the Ollama branch.
    assert.equal(result.length, 0)
  })
})
