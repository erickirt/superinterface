import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isOpenaiComputerUseModel,
  isOpenaiResponsesComputerUseModel,
} from '@/lib/tools/isOpenaiResponsesComputerUseModel'
import { serializeComputerUseTool } from '@/lib/tools/serializeComputerUseTool'

test('isOpenaiComputerUseModel detects GPT-5.4', () => {
  assert.equal(isOpenaiComputerUseModel({ modelSlug: 'gpt-5.4' }), true)
  assert.equal(isOpenaiComputerUseModel({ modelSlug: 'gpt-4o' }), false)
})

test('isOpenaiResponsesComputerUseModel only enables OpenAI Responses GPT-5.4', () => {
  assert.equal(
    isOpenaiResponsesComputerUseModel({
      assistant: {
        modelSlug: 'gpt-5.4',
        modelProvider: { type: 'OPENAI' as any },
        storageProviderType: 'OPENAI_RESPONSES' as any,
      },
    }),
    true,
  )

  assert.equal(
    isOpenaiResponsesComputerUseModel({
      assistant: {
        modelSlug: 'gpt-5.4',
        modelProvider: { type: 'AZURE_OPENAI' as any },
        storageProviderType: 'AZURE_RESPONSES' as any,
      },
    }),
    false,
  )
})

test('serializeComputerUseTool emits nested GA computer config', () => {
  const tool = serializeComputerUseTool({
    tool: {
      computerUseTool: {
        environment: 'MACOS',
        displayWidth: 1440,
        displayHeight: 900,
      },
    },
    useOpenaiComputerTool: true,
  })

  assert.deepEqual(tool, {
    type: 'computer',
    computer: {
      environment: 'mac',
      display_width: 1440,
      display_height: 900,
    },
  })
})
