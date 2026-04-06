type ComputerUseToolLike = {
  computerUseTool?: {
    displayHeight: number
    displayWidth: number
    environment: string
  } | null
}

const serializeEnvironment = ({ environment }: { environment: string }) => {
  const normalized = environment.toLowerCase()

  if (normalized === 'macos') {
    return 'mac'
  }

  return normalized
}

export const serializeComputerUseTool = ({
  tool,
  useOpenaiComputerTool,
}: {
  tool: ComputerUseToolLike
  useOpenaiComputerTool: boolean
}) => {
  if (useOpenaiComputerTool) {
    return { type: 'computer' } as any
  }

  return {
    type: 'computer_use_preview',
    computer_use_preview: {
      environment: serializeEnvironment({
        environment: tool.computerUseTool!.environment,
      }),
      display_width: tool.computerUseTool!.displayWidth,
      display_height: tool.computerUseTool!.displayHeight,
    },
  } as any
}
