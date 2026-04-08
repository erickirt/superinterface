import { ModelProviderType, StorageProviderType } from '@prisma/client'

export const isOpenaiComputerUseModel = ({
  modelSlug,
}: {
  modelSlug: string
}) => {
  const normalized = modelSlug.trim().toLowerCase()

  return normalized === 'gpt-5.4' || normalized.startsWith('gpt-5.4-')
}

export const isOpenaiResponsesComputerUseModel = ({
  assistant,
}: {
  assistant: {
    modelSlug: string
    modelProvider: {
      type: ModelProviderType
    }
    storageProviderType: StorageProviderType
  }
}) =>
  assistant.modelProvider.type === ModelProviderType.OPENAI &&
  assistant.storageProviderType === StorageProviderType.OPENAI_RESPONSES &&
  isOpenaiComputerUseModel({
    modelSlug: assistant.modelSlug,
  })
