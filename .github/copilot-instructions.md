# Project Guidelines — Banacanvas

Google Gemini AI image generation Web UI — text-to-image, image editing, multi-provider, bilingual (EN/ZH), dark mode, generation history.

## Architecture

- **Stack**: Vue 3 + TypeScript (strict) + Vite 8 + Tailwind CSS v4 + Pinia
- **No router** — single-page UI with modals/sidebar overlays
- **Components**: `<script setup lang="ts">` SFC, Headless UI for accessible primitives
- **State**: Pinia stores (`apiKey`, `history`) + component-local reactive refs
- **Composables**: `useGemini`, `useOpenRouter`, `useVercelAI` (API calls), `useI18n` (translation), `useTheme` (theme)
- **Types**: all interfaces in `src/types/index.ts`
- **i18n**: custom composable, `MessageKey` type-constrained, supports `en`/`zh`
- **Storage**: localStorage for API keys, theme, locale, history

### Multi-Provider Routing

App.vue dynamically selects composable based on `selectedModel.provider`:

```ts
const api = provider === 'vercel' ? vercelAI : provider === 'openrouter' ? openRouter : gemini
```

All three composables expose identical public interface: `{ loading, error, generateImage, editImage, cancel }`.

- **useGemini**: `@google/genai` SDK with streaming (`generateContentStream`). Must iterate all chunks for final `usageMetadata`.
- **useOpenRouter / useVercelAI**: Standard `fetch` + JSON response (no streaming). useVercelAI wraps config in `providerOptions.google.imageConfig`.
- **Model ID mapping**: OpenRouter/Vercel use `google/` prefix (`google/gemini-3.1-flash-image-preview`). Use `getBaseModelId()` from `src/config/models.ts` for pricing lookups.

### Component Communication

- **`defineModel`** for two-way binding (v-model) — used in `GenerationPanel`, `ParameterPanel`
- **`defineEmits`** for non-data events (`@generate`, `@cancel`, `@providerChange`)
- **No provide/inject** — composition via stores + composables only
- **Toast**: App.vue manages toast array locally, 5-second auto-cleanup; `Toast.vue` is stateless

## Build & Dev

```bash
npm install   # npm only (package-lock.json)
npm run dev   # Vite dev server
npm run build # vue-tsc type check + Vite production build
npm run preview
```

No test framework configured.

## Code Style

- PascalCase component names, camelCase functions/variables, camelCase file names
- All components use `<script setup lang="ts">`
- Types in `src/types/index.ts`, import as needed
- Tailwind utility classes in templates, dark mode via `dark:` prefix
- Primary color: violet (`violet-500`, `violet-600`). Error: red, success: green
- localStorage reads/writes only in stores and composables, never in components
- Async functions use try-catch; errors shown via Toast and inline messages
- i18n keys must be defined in `src/i18n/messages.ts` with `MessageKey` type
- Error typing: `catch (e: unknown)` with `e instanceof Error ? e.message : String(e)`

## Conventions

- New translations must include both `en` and `zh`
- Model config (sizes, ratios, pricing) in `src/config/models.ts`
- History capped at 50 entries; auto-trims oldest on localStorage quota exceeded
- Gemini streaming: iterate all chunks for final `usageMetadata` — partial collection loses cost data
- On model/provider change: validate and reset unsupported aspect ratios/sizes via `getAspectRatios()` / `getImageSizes()`
- Provider-specific features (thinking level, Google Search, person generation) guarded by `provider === 'gemini'`
- AbortController must be set to `null` in finally block to avoid interference with next request
- Responsive layout: two copies of GenerationPanel in template — `md:hidden` (mobile) and `hidden md:flex` (desktop)
- Deploy to Vercel; SPA rewrite in `vercel.json`
- Tailwind v4 via `@tailwindcss/vite` plugin — no `tailwind.config.js`

## Key Dependencies

| Package | Role |
|---|---|
| `@google/genai` | Gemini SDK (streaming generation + image input) |
| `@headlessui/vue` | Accessible UI components (Dialog, Listbox, Transition) |
| `pinia` | State management |
| `tailwindcss` + `@tailwindcss/vite` | CSS framework (v4) |
