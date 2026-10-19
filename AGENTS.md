# Project Guidelines — Banacanvas

Google Gemini AI image generation Web UI — text-to-image, image editing, multi-provider, bilingual (EN/ZH), dark mode, batch generation, generation history.

See [README.md](../README.md) for user-facing features and [README.zh.md](../README.zh.md) for Chinese version.

## Architecture

- **Stack**: Vue 3 + TypeScript (strict) + Vite 8 + Tailwind CSS v4 + Pinia
- **No router** — single-page UI with modals/sidebar overlays
- **Components**: `<script setup lang="ts">` SFC, Headless UI for accessible primitives
- **State**: Pinia stores (`apiKey`, `history`) + component-local reactive refs
- **Composables**: `useGemini`, `useOpenRouter`, `useVercelAI` (provider API calls), `useImageGeneration` (single/batch runs + result state), `useGenerationParams` (persisted model/config + model/provider switching), `useEndNotification`, `useResizableSidebar`, `useReferenceImageResize`, `useHistoryPreferences`, `useI18n` (translation), `useTheme` (theme)
- **App.vue** is a composition surface: it wires composables to components; keep feature logic in composables
- **Types**: all interfaces in [src/types/index.ts](../src/types/index.ts)
- **i18n**: custom composable in [src/i18n/messages.ts](../src/i18n/messages.ts), `MessageKey` type-constrained, supports `en`/`zh`
- **Storage**: localStorage for API keys / theme / locale / config; **IndexedDB** (via [src/stores/history.ts](../src/stores/history.ts)) for generation history

### Multi-Provider Routing

`useImageGeneration` holds one instance of each provider composable in a `Record<Provider, …>` map and picks one by `config.provider`:

```ts
const api = providers[request.config.provider]
```

All three composables expose identical public interface: `{ loading, error, generateImage, editImage, cancel }`.

- **useGemini**: `@google/genai` SDK with streaming (`generateContentStream`). Must iterate all chunks for final `usageMetadata`.
- **useOpenRouter**: Standard `fetch` + JSON response (no streaming); chat-completions API for Gemini models, `/api/v1/images` for image-API models.
- **useVercelAI**: Vercel AI SDK (`ai` package, `createGateway` + `generateText` / `generateImage`); Gemini config goes in `providerOptions.google.imageConfig`.
- **Model ID mapping**: OpenRouter/Vercel use `google/` prefix (`google/gemini-3.1-flash-image`). Use `getBaseModelId()` from `src/config/models.ts` for pricing lookups.

### Component Communication

- **`defineModel`** for two-way binding (v-model) — used in `GenerationPanel`, `ParameterPanel`
- **`defineEmits`** for non-data events (`@generate`, `@cancel`, `@providerChange`)
- **No provide/inject** — composition via stores + composables only
- **Toast**: App.vue manages toast array locally, 5-second auto-cleanup; `Toast.vue` is stateless

### Batch Generation

- Configurable `batchSize` (1–9). When `> 1`, `useImageGeneration.runBatch` runs N parallel requests on the shared provider composable, each with its own external `AbortSignal`, via `Promise.allSettled`, tracking `batchControllers: AbortController[]` and `batchProgress` ref.
- Single-generation path (`batchSize === 1`, `runSingle`) uses the composable's managed `loading`/abort state — do not unify it with `runBatch`.
- Results stored in `batchResults: BatchResultItem[]`; each successful item is persisted to history independently.

### History (IndexedDB)

- Object store `history` in DB `banacanvas`, keyed by `id`, indexed by `timestamp`.
- Images stored as base64 strings on each entry (re-encoded to WebP at quality 0.85 on save); the whole history is loaded into memory on `init()`.
- **No entry cap** — relies on browser storage quota; UI shows usage via `navigator.storage.estimate()`.
- Auto-migrates legacy localStorage history on first load, then removes it.
- Import/export uses JSZip (zip contains `metadata.json` + `images/` folder).

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
- History stored in IndexedDB without a hard entry cap — never reintroduce the old 50-entry localStorage trim; images are re-encoded to WebP before saving
- Gemini streaming: iterate all chunks for final `usageMetadata` — partial collection loses cost data
- On model/provider change: validate and reset unsupported aspect ratios/sizes via `getAspectRatios()` / `getImageSizes()`
- Provider-specific features (thinking level, Google Search, person generation) guarded by `provider === 'gemini'`
- AbortController must be set to `null` in finally block to avoid interference with next request
- Responsive layout: two copies of GenerationPanel in template — `md:hidden` (mobile) and `hidden md:flex` (desktop)
- Deploy to Vercel; SPA rewrite in `vercel.json`
- Tailwind v4 via `@tailwindcss/vite` plugin — no `tailwind.config.js`
- Keep heavy dependencies out of the initial bundle: `@google/genai`, `ai` and `jszip` are loaded with dynamic `import()` at first use (type-only static imports are fine); `ApiKeyDialog` and `HistoryPanel` are `defineAsyncComponent`s, and `HistoryPanel` mounts on first open

## Key Dependencies

| Package | Role |
|---|---|
| `@google/genai` | Gemini SDK (streaming generation + image input) |
| `ai` | Vercel AI SDK (AI Gateway provider) |
| `@headlessui/vue` | Accessible UI components (Dialog, Listbox, Transition) |
| `pinia` | State management |
| `jszip` | Pack/unpack history import/export archives |
| `tailwindcss` + `@tailwindcss/vite` | CSS framework (v4) |
