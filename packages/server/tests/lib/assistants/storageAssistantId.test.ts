import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Assistant, StorageProviderType } from '@prisma/client'
import { storageAssistantId } from '@/lib/assistants/storageAssistantId'

describe('storageAssistantId', () => {
  it('returns openaiAssistantId for OPENAI storage', () => {
    const assistant = {
      id: 'local-assistant-id',
      openaiAssistantId: 'asst_openai123',
      storageProviderType: StorageProviderType.OPENAI,
    } as unknown as Assistant

    assert.strictEqual(storageAssistantId({ assistant }), 'asst_openai123')
  })

  it('returns openaiAssistantId for AZURE_OPENAI storage', () => {
    const assistant = {
      id: 'local-assistant-id',
      openaiAssistantId: 'asst_azure456',
      storageProviderType: StorageProviderType.AZURE_OPENAI,
    } as unknown as Assistant

    assert.strictEqual(storageAssistantId({ assistant }), 'asst_azure456')
  })

  it('returns azureAgentsAgentId for AZURE_AGENTS storage', () => {
    const assistant = {
      id: 'local-assistant-id',
      azureAgentsAgentId: 'agent_789',
      storageProviderType: StorageProviderType.AZURE_AGENTS,
    } as unknown as Assistant

    assert.strictEqual(storageAssistantId({ assistant }), 'agent_789')
  })

  it('returns assistant id for OPENAI_RESPONSES storage', () => {
    const assistant = {
      id: 'local-assistant-id',
      storageProviderType: StorageProviderType.OPENAI_RESPONSES,
    } as unknown as Assistant

    assert.strictEqual(storageAssistantId({ assistant }), 'local-assistant-id')
  })

  it('returns assistant id for AZURE_RESPONSES storage without agent reference', () => {
    const assistant = {
      id: 'local-assistant-id',
      storageProviderType: StorageProviderType.AZURE_RESPONSES,
    } as unknown as Assistant

    assert.strictEqual(storageAssistantId({ assistant }), 'local-assistant-id')
  })

  it('returns azureResponsesAgentName for AZURE_RESPONSES storage with agent reference', () => {
    const assistant = {
      id: 'local-assistant-id',
      storageProviderType: StorageProviderType.AZURE_RESPONSES,
      azureResponsesAgentName: 'agent_name_123',
    } as unknown as Assistant

    assert.strictEqual(storageAssistantId({ assistant }), 'agent_name_123')
  })

  it('returns assistant id for SUPERINTERFACE_CLOUD storage', () => {
    const assistant = {
      id: 'local-assistant-id',
      storageProviderType: StorageProviderType.SUPERINTERFACE_CLOUD,
    } as unknown as Assistant

    assert.strictEqual(storageAssistantId({ assistant }), 'local-assistant-id')
  })

  it('throws error for invalid storage type', () => {
    const assistant = {
      id: 'local-assistant-id',
      storageProviderType: 'INVALID_TYPE' as unknown as StorageProviderType,
    } as unknown as Assistant

    assert.throws(
      () => storageAssistantId({ assistant }),
      /Invalid storage type/,
    )
  })
})
