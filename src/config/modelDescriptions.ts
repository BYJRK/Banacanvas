import type { MessageKey } from '../i18n/messages'
import type { ModelOption } from '../types'

/** Localized description per `provider:modelId`; every entry in AVAILABLE_MODELS must have one. */
export const MODEL_DESCRIPTION_KEYS: Record<string, MessageKey> = {
  'openrouter:qwen/qwen-image-2.1-pro': 'modelQwenImage21ProDesc',
  'openrouter:qwen/qwen-image-2.1-turbo': 'modelQwenImage21TurboDesc',
  'gemini:gemini-nano-banana-2.1': 'modelNanoBanana21Desc',
  'gemini:gemini-3.1-flash-image': 'modelNanoBanana2Desc',
  'gemini:gemini-3-pro-image': 'modelNanoBananaProDesc',
  'gemini:gemini-3.1-flash-lite-image': 'modelNanoBanana2LiteDesc',
  'openrouter:google/gemini-nano-banana-2.1': 'modelORNanoBanana21Desc',
  'openrouter:google/gemini-3.1-flash-image': 'modelORNanoBanana2Desc',
  'openrouter:google/gemini-3-pro-image': 'modelORNanoBananaProDesc',
  'openrouter:google/gemini-3.1-flash-lite-image': 'modelORNanoBanana2LiteDesc',
  'openrouter:x-ai/grok-imagine-image-quality': 'modelGrokImagineDesc',
  'openrouter:x-ai/grok-imagine-image-2.0': 'modelGrokImagine2Desc',
  'openrouter:bytedance-seed/seedream-5-0-pro': 'modelSeedream50ProDesc',
  'openrouter:bytedance-seed/seedream-5-0-lite': 'modelSeedream50LiteDesc',
  'openrouter:sourceful/riverflow-v2.5-pro': 'modelRiverflowV25ProDesc',
  'openrouter:sourceful/riverflow-v2.5-fast': 'modelRiverflowV25FastDesc',
  'openrouter:meta/muse-image': 'modelMuseImageDesc',
  'openrouter:microsoft/mai-image-2.6': 'modelMaiImage26Desc',
  'openrouter:microsoft/mai-image-2.6-flash': 'modelMaiImage26FlashDesc',
  'vercel:microsoft/mai-image-2.6': 'modelMaiImage26Desc',
  'vercel:microsoft/mai-image-2.6-flash': 'modelMaiImage26FlashDesc',
  'openrouter:openai/gpt-image-2.5-flare': 'modelGptImage25FlareDesc',
  'openrouter:openai/gpt-image-2.5-sunburst': 'modelGptImage25SunburstDesc',
  'vercel:openai/gpt-image-2.5-flare': 'modelGptImage25FlareDesc',
  'vercel:openai/gpt-image-2.5-sunburst': 'modelGptImage25SunburstDesc',
  'vercel:google/gemini-nano-banana-2.1': 'modelVercelNanoBanana21Desc',
  'vercel:google/gemini-3.1-flash-image': 'modelVercelNanoBanana2Desc',
  'vercel:google/gemini-3-pro-image': 'modelVercelNanoBananaProDesc',
  'vercel:google/gemini-3.1-flash-lite-image': 'modelVercelNanoBanana2LiteDesc',
}

export function getModelDescriptionKey(model: Pick<ModelOption, 'id' | 'provider'>): MessageKey | undefined {
  return MODEL_DESCRIPTION_KEYS[`${model.provider}:${model.id}`]
}
