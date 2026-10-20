import { describe, expect, it } from 'vitest'
import {
  GEMINI_FLASH_IMAGE_MODEL,
  GPT_IMAGE_2_5_FLARE_MODEL,
  MAI_IMAGE_2_6_MODEL,
  estimateImageOutputCost,
  getResolution,
} from '../src/config/models'
import { estimateConfigCost, formatCost, getGenerationSpec, isImageSizeConfigurable, ratioGlyphSize } from '../src/generationSpec'

describe('getGenerationSpec', () => {
  it('summarizes ratio, size, resolution and unit/total cost', () => {
    const spec = getGenerationSpec(GEMINI_FLASH_IMAGE_MODEL, 'gemini', { aspectRatio: '16:9', imageSize: '2K' }, 4)
    expect(spec.aspectRatio).toBe('16:9')
    expect(spec.imageSize).toBe('2K')
    expect(spec.resolution).toBe(getResolution('16:9', '2K', GEMINI_FLASH_IMAGE_MODEL, 'gemini'))
    expect(spec.unitCost).toBe(estimateImageOutputCost(GEMINI_FLASH_IMAGE_MODEL, '2K', 1, undefined, 'gemini', '16:9'))
    expect(spec.totalCost).toBeCloseTo(spec.unitCost! * 4)
  })

  it('defaults to 1:1 / 1K and omits resolution for auto ratio', () => {
    expect(getGenerationSpec(GEMINI_FLASH_IMAGE_MODEL, 'gemini', {}, 1)).toMatchObject({ aspectRatio: '1:1', imageSize: '1K' })
    expect(getGenerationSpec(MAI_IMAGE_2_6_MODEL, 'vercel', { aspectRatio: 'auto', imageSize: '1.5K' }, 1)).toMatchObject({
      aspectRatio: 'auto',
      imageSize: undefined,
      resolution: undefined,
    })
  })
})

describe('estimateConfigCost', () => {
  it('prices MAI auto-ratio jobs at 1K regardless of the stored size', () => {
    expect(estimateConfigCost(MAI_IMAGE_2_6_MODEL, 'vercel', { aspectRatio: 'auto', imageSize: '1.5K' }, 2))
      .toBe(estimateImageOutputCost(MAI_IMAGE_2_6_MODEL, '1K', 2, undefined, 'vercel', 'auto'))
  })
})

describe('isImageSizeConfigurable', () => {
  it('hides size for MAI/GPT on auto ratio', () => {
    expect(isImageSizeConfigurable(MAI_IMAGE_2_6_MODEL, 'vercel', 'auto')).toBe(false)
    expect(isImageSizeConfigurable(GPT_IMAGE_2_5_FLARE_MODEL, 'vercel', 'auto')).toBe(false)
    expect(isImageSizeConfigurable(GEMINI_FLASH_IMAGE_MODEL, 'gemini', '1:1')).toBe(true)
  })
})

describe('formatCost', () => {
  it('uses precision suited to the magnitude', () => {
    expect(formatCost(0.0004, GEMINI_FLASH_IMAGE_MODEL)).toBe('0.000400')
    expect(formatCost(0.067, GEMINI_FLASH_IMAGE_MODEL)).toBe('0.0670')
    expect(formatCost(0.27, GEMINI_FLASH_IMAGE_MODEL)).toBe('0.27')
    expect(formatCost(0.27, GPT_IMAGE_2_5_FLARE_MODEL)).toBe('0.270')
  })
})

describe('ratioGlyphSize', () => {
  it('fits the ratio inside the box with a minimum side', () => {
    expect(ratioGlyphSize('1:1')).toEqual({ width: 14, height: 14 })
    expect(ratioGlyphSize('16:9')).toEqual({ width: 14, height: 8 })
    expect(ratioGlyphSize('9:16')).toEqual({ width: 8, height: 14 })
    expect(ratioGlyphSize('8:1')).toEqual({ width: 14, height: 4 })
    expect(ratioGlyphSize('auto')).toEqual({ width: 14, height: 14 })
  })
})
