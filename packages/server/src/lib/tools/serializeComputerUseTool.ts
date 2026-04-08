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
  const config = {
    environment: serializeEnvironment({
      environment: tool.computerUseTool!.environment,
    }),
    display_width: tool.computerUseTool!.displayWidth,
    display_height: tool.computerUseTool!.displayHeight,
  }

  if (useOpenaiComputerTool) {
    return {
      type: 'computer',
      computer: config,
    } as any
  }

  return {
    type: 'computer_use_preview',
    computer_use_preview: config,
  } as any
}
