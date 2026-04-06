export type TaskScheduler = {
  publishJSON: (options: {
    url: string
    body: Record<string, unknown>
    delay: number
  }) => Promise<{ messageId: string }>
  messages: {
    delete: (messageId: string) => Promise<void>
  }
}
