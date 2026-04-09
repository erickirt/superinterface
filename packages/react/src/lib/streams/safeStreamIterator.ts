/**
 * Iterate an async iterable stream, skipping JSON parse errors from
 * Azure's SSE keepalive events (empty data that causes "Unexpected end of JSON input").
 * Real errors are re-thrown.
 */
export async function* safeStreamIterator<T>(
  stream: AsyncIterable<T>,
): AsyncGenerator<T> {
  const iterator = (stream as any)[Symbol.asyncIterator]()
  while (true) {
    let result: IteratorResult<T>
    try {
      result = await iterator.next()
    } catch (e: any) {
      const msg = e?.message ?? ''
      const causeMsg = e?.cause?.message ?? ''
      if (
        msg.includes('Unexpected end of JSON input') ||
        causeMsg.includes('Unexpected end of JSON input')
      ) {
        continue
      }
      throw e
    }
    if (result.done) break
    yield result.value
  }
}
