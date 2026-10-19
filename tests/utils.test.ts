import { describe, expect, it } from 'vitest'
import { isAbortError } from '../src/abort'
import { getHistoryInputImages } from '../src/historyImages'

describe('isAbortError', () => {
  it('treats any error as cancellation once the signal is aborted', () => {
    const controller = new AbortController()
    controller.abort()
    expect(isAbortError(new Error('stream closed'), controller.signal)).toBe(true)
  })

  it('recognises AbortError without a signal', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true)
    const named = new Error('cancelled')
    named.name = 'AbortError'
    expect(isAbortError(named)).toBe(true)
  })

  it('does not match messages that merely mention "abort"', () => {
    expect(isAbortError(new Error('Upstream aborted the job'), new AbortController().signal)).toBe(false)
    expect(isAbortError('AbortError')).toBe(false)
  })
})

describe('getHistoryInputImages', () => {
  it('prefers the inputImages array', () => {
    const inputImages = [{ base64: 'a', mimeType: 'image/png' }]
    expect(getHistoryInputImages({ inputImages, inputImageBase64: 'legacy', inputImageMimeType: 'image/jpeg' })).toBe(inputImages)
  })

  it('upgrades the legacy single input image fields', () => {
    expect(getHistoryInputImages({ inputImageBase64: 'legacy', inputImageMimeType: 'image/jpeg' }))
      .toEqual([{ base64: 'legacy', mimeType: 'image/jpeg' }])
  })

  it('returns an empty list when there are no references', () => {
    expect(getHistoryInputImages({})).toEqual([])
    expect(getHistoryInputImages({ inputImageBase64: 'orphan' })).toEqual([])
  })
})
