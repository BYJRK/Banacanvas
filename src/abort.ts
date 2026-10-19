/** True when the request was cancelled via its AbortSignal, regardless of how the SDK wrapped the error. */
export function isAbortError(e: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  return e instanceof Error && e.name === 'AbortError'
}
