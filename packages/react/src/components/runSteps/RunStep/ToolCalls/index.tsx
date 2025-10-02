import type OpenAI from 'openai'
import { Flex } from '@radix-ui/themes'
import type { SerializedRunStep, StyleProps } from '@/types'
import { ToolCall } from './ToolCall'
import { useComponents } from '@/hooks/components/useComponents'

type Args = {
  stepDetails: OpenAI.Beta.Threads.Runs.ToolCallsStepDetails
  runStep: SerializedRunStep
} & StyleProps

const Root = ({
  children,
  className,
  style,
}: {
  children: React.ReactNode
} & StyleProps) => (
  <Flex
    direction="column"
    className={className}
    style={style}
  >
    {children}
  </Flex>
)

const StartingToolCalls = () => {
  const {
    components: { StartingToolCalls },
  } = useComponents()

  return <StartingToolCalls />
}

export const ToolCalls = ({ stepDetails, runStep, className, style }: Args) => (
  <Root
    className={className}
    style={style}
  >
    {!stepDetails.tool_calls.length && <StartingToolCalls />}
    {stepDetails.tool_calls.map((toolCall) => (
      <ToolCall
        key={toolCall.id}
        toolCall={toolCall}
        runStep={runStep}
      />
    ))}
  </Root>
)

ToolCalls.Root = Root
ToolCalls.StartingToolCalls = StartingToolCalls
ToolCalls.ToolCall = ToolCall
