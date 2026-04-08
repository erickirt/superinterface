import OpenAI from 'openai'

type ComputerAction = Record<string, unknown> & {
  type: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isComputerAction = (value: unknown): value is ComputerAction =>
  isRecord(value) && typeof value.type === 'string'

const getPendingSafetyChecks = ({
  toolCall,
}: {
  toolCall: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall
}) => {
  const computerCall = (toolCall as any).computer_call

  if (
    !isRecord(computerCall) ||
    !Array.isArray(computerCall.pending_safety_checks)
  ) {
    return []
  }

  return computerCall.pending_safety_checks
    .filter(
      (psc): psc is { id: string } =>
        isRecord(psc) && typeof psc.id === 'string',
    )
    .map((psc) => ({
      id: psc.id,
    }))
}

export const getComputerCallActions = ({
  toolCall,
}: {
  toolCall: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall
}) => {
  const computerCall = (toolCall as any).computer_call

  if (!isRecord(computerCall)) {
    return {
      actions: [],
      acknowledgedSafetyChecks: [],
    }
  }

  if (Array.isArray(computerCall.actions)) {
    return {
      actions: computerCall.actions.filter(isComputerAction),
      acknowledgedSafetyChecks: getPendingSafetyChecks({ toolCall }),
    }
  }

  if (isComputerAction(computerCall.action)) {
    return {
      actions: [computerCall.action],
      acknowledgedSafetyChecks: getPendingSafetyChecks({ toolCall }),
    }
  }

  return {
    actions: [],
    acknowledgedSafetyChecks: getPendingSafetyChecks({ toolCall }),
  }
}
