import messages from '../src/i18n/messages'

/** English UI strings, matching the locale pinned in tests/setup.ts. */
export const en = messages.en

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Promise that rejects with the signal's reason once it is aborted, like fetch does. */
export function waitForAbort(signal: AbortSignal | null | undefined, error?: unknown): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return
    const fail = () => reject(error ?? signal.reason)
    if (signal.aborted) fail()
    else signal.addEventListener('abort', fail)
  })
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** Tiny base64 payload standing in for real image bytes. */
export const IMAGE_B64 = btoa('fake-image')

export function inputImage(index = 0, mimeType = 'image/png') {
  return { id: `img-${index}`, base64: btoa(`ref-${index}`), mimeType }
}

export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))
