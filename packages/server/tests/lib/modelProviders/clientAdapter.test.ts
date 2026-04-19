/**
 * Unit tests for `clientAdapter()` — the factory that picks which supercompat
 * client adapter to return for a given model-provider type.
 *
 * Historical gap: OLLAMA was routed through `buildOpenaiClientAdapter`
 * (generic `openaiClientAdapter` wrapper) instead of `ollamaClientAdapter`.
 * That's wrong because `ollamaClientAdapter` does Ollama-specific work that
 * `openaiClientAdapter` doesn't:
 *   - rewrites `computer_use_preview` → plain function tool Ollama can call
 *   - denormalizes 0-1000 coordinates back to pixels
 *   - fuzzy-extracts `box_2d` fallback clicks
 *   - relays tool-role screenshots through a follow-up user message
 *     (Ollama silently drops images on tool-role messages)
 *
 * Without these, computer-use on Ollama appears to half-work — the tool
 * fires but the model never actually sees the screenshot, so it refuses or
 * hallucinates.
 *
 * We spy on the supercompat import via `mock.module` rather than inspecting
 * the returned object's shape, because both adapters return the same
 * `{ client, requestHandlers }` structure and are otherwise hard to tell
 * apart without exercising an actual request.
 */

import { test, mock } from 'node:test'
import type { MockModuleOptions } from 'node:test'
import assert from 'node:assert/strict'
import { ModelProviderType, StorageProviderType } from '@prisma/client'

type AdapterCall = { name: string; args: unknown[] }
const adapterCalls: AdapterCall[] = []

const spyAdapter =
  (name: string) =>
  (...args: unknown[]) => {
    adapterCalls.push({ name, args })
    return { __marker: name, requestHandlers: {}, client: null }
  }

const supercompatMock: MockModuleOptions = {
  namedExports: {
    // Client adapters clientAdapter.ts routes to directly
    ollamaClientAdapter: spyAdapter('ollamaClientAdapter'),
    openaiClientAdapter: spyAdapter('openaiClientAdapter'),
    anthropicClientAdapter: spyAdapter('anthropicClientAdapter'),
    googleClientAdapter: spyAdapter('googleClientAdapter'),
    groqClientAdapter: spyAdapter('groqClientAdapter'),
    mistralClientAdapter: spyAdapter('mistralClientAdapter'),
    openRouterClientAdapter: spyAdapter('openRouterClientAdapter'),
    perplexityClientAdapter: spyAdapter('perplexityClientAdapter'),
    humirisClientAdapter: spyAdapter('humirisClientAdapter'),
    togetherClientAdapter: spyAdapter('togetherClientAdapter'),
    azureAiProjectClientAdapter: spyAdapter('azureAiProjectClientAdapter'),
    // Transitively required by `buildAzureOpenaiClientAdapter`, which
    // `clientAdapter` imports even when we never exercise its branch.
    azureOpenaiClientAdapter: spyAdapter('azureOpenaiClientAdapter'),
  },
}

mock.module('supercompat/openai', supercompatMock)

// Import *after* mocking — the mock has to be registered before
// clientAdapter's module-level imports resolve.
const { clientAdapter } = await import('@/lib/modelProviders/clientAdapter')

const modelProvider = (
  overrides: Partial<{
    type: ModelProviderType
    apiKey: string | null
    endpoint: string | null
  }> = {},
) =>
  ({
    id: 'model-provider-id',
    workspaceId: 'workspace-id',
    name: 'test',
    type: ModelProviderType.OLLAMA,
    apiKey: null,
    endpoint: 'http://localhost:11434/v1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

test('clientAdapter routes OLLAMA to ollamaClientAdapter', () => {
  adapterCalls.length = 0

  const adapter = clientAdapter({
    modelProvider: modelProvider({ type: ModelProviderType.OLLAMA }),
    storageProviderType: StorageProviderType.SUPERINTERFACE_CLOUD,
  })

  const ollamaCalls = adapterCalls.filter(
    (c) => c.name === 'ollamaClientAdapter',
  )
  assert.equal(
    ollamaCalls.length,
    1,
    'ollamaClientAdapter must be called exactly once for OLLAMA provider',
  )

  const openaiCalls = adapterCalls.filter(
    (c) => c.name === 'openaiClientAdapter',
  )
  assert.equal(
    openaiCalls.length,
    0,
    'openaiClientAdapter must NOT be called for OLLAMA — that was the bug',
  )

  assert.equal(
    (adapter as { __marker: string }).__marker,
    'ollamaClientAdapter',
    'returned adapter should be the one produced by ollamaClientAdapter',
  )
})

test('clientAdapter passes the Ollama endpoint as baseURL to the OpenAI client', () => {
  adapterCalls.length = 0

  clientAdapter({
    modelProvider: modelProvider({
      type: ModelProviderType.OLLAMA,
      endpoint: 'http://gpu-box.local:11434/v1',
    }),
    storageProviderType: StorageProviderType.SUPERINTERFACE_CLOUD,
  })

  const [call] = adapterCalls.filter((c) => c.name === 'ollamaClientAdapter')
  assert.ok(call, 'ollamaClientAdapter should have been called')

  // ollamaClientAdapter is called as ollamaClientAdapter({ ollama: new OpenAI(...) })
  const [arg] = call.args as [{ ollama: { baseURL: string; apiKey: string } }]
  assert.equal(
    arg.ollama.baseURL,
    'http://gpu-box.local:11434/v1',
    'baseURL must come from modelProvider.endpoint',
  )
  assert.equal(
    arg.ollama.apiKey,
    'ollama',
    'apiKey is hardcoded to "ollama" — Ollama ignores it but OpenAI SDK requires non-empty',
  )
})

test('clientAdapter routes OPENAI through openaiClientAdapter (regression guard)', () => {
  adapterCalls.length = 0

  clientAdapter({
    modelProvider: modelProvider({
      type: ModelProviderType.OPENAI,
      apiKey: 'sk-test',
    }),
    storageProviderType: StorageProviderType.OPENAI,
  })

  const openaiCalls = adapterCalls.filter(
    (c) => c.name === 'openaiClientAdapter',
  )
  assert.equal(
    openaiCalls.length,
    1,
    'OPENAI must still use openaiClientAdapter',
  )

  const ollamaCalls = adapterCalls.filter(
    (c) => c.name === 'ollamaClientAdapter',
  )
  assert.equal(
    ollamaCalls.length,
    0,
    'OPENAI must not accidentally route to ollamaClientAdapter',
  )
})

test('clientAdapter routes ANTHROPIC through anthropicClientAdapter (regression guard)', () => {
  adapterCalls.length = 0

  clientAdapter({
    modelProvider: modelProvider({
      type: ModelProviderType.ANTHROPIC,
      apiKey: 'sk-ant-test',
    }),
    storageProviderType: StorageProviderType.SUPERINTERFACE_CLOUD,
  })

  const anthropicCalls = adapterCalls.filter(
    (c) => c.name === 'anthropicClientAdapter',
  )
  assert.equal(anthropicCalls.length, 1)

  const ollamaCalls = adapterCalls.filter(
    (c) => c.name === 'ollamaClientAdapter',
  )
  assert.equal(ollamaCalls.length, 0)
})
