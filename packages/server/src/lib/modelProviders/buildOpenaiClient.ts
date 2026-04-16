import { ModelProvider, StorageProviderType } from '@prisma/client'
import { clientAdapter } from '@/lib/modelProviders/clientAdapter'
import { supercompat } from 'supercompat/openai'

export const buildOpenaiClient = ({
  modelProvider,
}: {
  modelProvider: ModelProvider
}) =>
  supercompat({
    clientAdapter: clientAdapter({
      modelProvider,
      storageProviderType: StorageProviderType.SUPERINTERFACE_CLOUD,
    }),
  })
