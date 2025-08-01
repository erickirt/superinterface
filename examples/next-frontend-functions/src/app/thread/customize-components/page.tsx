'use client'

import type OpenAI from 'openai'
import { useState } from 'react'
import {
  SuperinterfaceProvider,
  Thread,
  AssistantNameContext,
  ComponentsProvider,
} from '@superinterface/react'
import { Theme, Flex } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const TextContent = ({
  content,
}: {
  content: OpenAI.Beta.Threads.Messages.TextContentBlock
}) => (
  <div
    style={{
      color: 'red',
    }}
  >
    {content.text.value}
  </div>
)

export default function Page() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 10000,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <Theme
        accentColor="blue"
        grayColor="gray"
        appearance="dark"
        radius="medium"
        scaling="100%"
      >
        <SuperinterfaceProvider
          variables={{
            publicApiKey: '29a25789-15d4-4f5f-a150-aa6d4e64a03b',
            assistantId: '5b211b08-0fb9-48d9-8044-17c60d2e3a34',
          }}
        >
          <AssistantNameContext.Provider value="Annotations tester">
            <ComponentsProvider
              components={{
                TextContent,
              }}
            >
              <Flex height="100dvh">
                <Thread />
              </Flex>
            </ComponentsProvider>
          </AssistantNameContext.Provider>
        </SuperinterfaceProvider>
      </Theme>
    </QueryClientProvider>
  )
}
