import { ModelProvider } from '@prisma/client'
import { clientAdapter } from '@/lib/modelProviders/clientAdapter'
import { supercompat } from 'supercompat'

export const buildOpenaiClient = ({
  modelProvider,
}: {
  modelProvider: ModelProvider
}) =>
  supercompat({
    client: clientAdapter({
      modelProvider,
    }),
  })
