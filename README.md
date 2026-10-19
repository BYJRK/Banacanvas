# Banacanvas 🍌

English | [中文](./README.zh.md)

![Banacanvas icon](./public/apple-touch-icon.png)

A modern web UI for AI image generation powered by Google Gemini Image (aka. Nano Banana). Supports text-to-image, image editing with reference images, multiple API providers, bilingual interface, dark mode, generation history, and real-time cost estimation.

## Features

- **Multi-provider support** — Google Gemini direct API, OpenRouter, and Vercel AI Gateway
- **Text-to-image** — Describe what you want, get an image
- **Image editing** — Upload up to 16 reference images for guided generation/editing (limit depends on the model)
- **Streaming generation** — Real-time feedback as the image is being created
- **Configurable output** — Aspect ratio, image size (512 to 4K), thinking level, Google Search grounding, person generation control
- **Token counting & cost estimation** — Live display of input/output/thinking tokens, elapsed time, and estimated USD cost
- **Batch generation** — Generate up to 9 images simultaneously in parallel with a single prompt
- **Generation history** — Auto-saved in browser IndexedDB (no entry limit), click to restore any previous generation
- **Bilingual UI** — English and Chinese, auto-detected from browser locale
- **Dark mode** — System / Light / Dark, follows OS preference
- **Keyboard shortcut** — <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to generate
- **Drag-to-reorder** — Rearrange reference images by dragging

## Supported Providers & Models

All providers offer the four Gemini models below. OpenRouter additionally exposes models from Meta, xAI, ByteDance, and Sourceful in the model selector.

OpenRouter and Vercel AI Gateway also support **MAI-Image-2.6** (`microsoft/mai-image-2.6`) and **MAI-Image-2.6 Flash** (`microsoft/mai-image-2.6-flash`) from Microsoft. Both generate and edit images with up to 5 references, 7 fixed aspect ratios plus auto, and optional Bing web grounding. Vercel offers 1K / 1.5K pixel-budget presets (up to 1536² total pixels); OpenRouter currently exposes aspect ratio only. Standard pricing is $5 text input / $8 image input / $38 image output per million tokens; Flash is $1.75 / $2.50 / $19. Before generation, budget estimates are approximately $0.04/image for standard and $0.02/image for Flash. Vercel 1.5K doubles these estimates to $0.08/$0.04; totals are multiplied by the batch count. Completed jobs use returned billing or token usage. See [research and API details](./docs/mai-image-2.6.md) (verified October 15, 2026).

| Model | Internal Name | Resolution | Pricing (per 1M tokens) |
|---|---|---|---|
| **Nano Banana 2.1** | `gemini-nano-banana-2.1` | 1K – 4K | $1.50 input · $7.50 text output · $30 image output |
| **Nano Banana 2** | `gemini-3.1-flash-image` | 512 – 4K | $0.50 input · $3.00 text output · $60 image output |
| **Nano Banana Pro** | `gemini-3-pro-image` | 1K – 4K | $2.00 input · $12.00 text output · $120 image output |
| **Nano Banana 2 Lite** | `gemini-3.1-flash-lite-image` | 1K only | $0.25 input · $1.50 text output · $30 image output |

Nano Banana 2 Lite generates images in as fast as 4 seconds (per Nano Banana's official announcement), making it the fastest and cheapest option — at the cost of a fixed 1K output and no Google Search grounding.

OpenRouter also supports **Meta: Muse Image** (`meta/muse-image`) for agentic image generation, reference-image editing, multi-reference composition, and precise text rendering. It costs $0.01 per generated image; output dimensions are selected automatically by the model.

| Provider | Description |
|---|---|
| **Gemini** | Direct Google Gemini API. Full feature support including thinking levels, Google Search, and person generation settings. |
| **OpenRouter** | Routes requests through [OpenRouter](https://openrouter.ai). Useful for centralized API key management. |
| **Vercel AI Gateway** | Routes through Vercel's AI infrastructure with optimized delivery. |

**GPT Image 2.5 Flare and Sunburst** are available through OpenRouter and Vercel AI Gateway. Flare prioritizes speed; Sunburst prioritizes precise editing. Both support up to 16 reference images, six quality levels, and transparent backgrounds. Pricing is $5 text input / $8 image input / $30 image output per million tokens. Vercel offers pixel-size presets; OpenRouter currently exposes aspect ratio only. See [parameters, pricing, and integration details](./docs/gpt-image-2.5.md).

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173` with hot reload.

### Production Build

```bash
npm run build    # Type-check (vue-tsc) + Vite production build → dist/
npm run preview  # Preview the production build locally
```

## Usage

### API Keys (BYOK)

Bring your own API key. Click the **⚙** icon in the header to enter keys for the providers you want to use. Keys are stored locally in your browser and never sent to any third-party server.

| Provider | Where to get a key |
|---|---|
| Gemini | [Google AI Studio](https://aistudio.google.com/apikey) |
| OpenRouter | [OpenRouter Keys](https://openrouter.ai/keys) |
| Vercel AI | [Vercel Dashboard](https://vercel.com) |

### Generating Images

1. Select a **provider** and **model**
2. Type a prompt describing the image you want
3. *(Optional)* Upload reference images for image-to-image editing
4. Adjust settings — aspect ratio, image size, thinking level, etc.
5. Click **Generate** (or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd>)
6. View the result, download it, or open full-screen

### Configuration Options

| Option | Values | Notes |
|---|---|---|
| Aspect Ratio | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, ... | Flash supports additional ratios (1:4, 1:8, 4:1, 8:1); Lite is limited to the 10 standard ratios |
| Image Size | 512, 1K, 2K, 4K | Pro starts at 1K; Lite supports 1K only |
| Thinking Level | Minimal, High | Gemini provider only; affects reasoning depth & cost |
| Google Search | On / Off | Gemini provider only; enables web-grounded generation |
| Person Generation | Allow All / Adults Only / None | Gemini provider only |

## Tech Stack

| Package | Role |
|---|---|
| [Vue 3](https://vuejs.org/) | UI framework (Composition API, `<script setup>` SFCs) |
| [TypeScript](https://www.typescriptlang.org/) 5.9 | Strict type checking |
| [Vite](https://vite.dev/) 8 | Dev server & bundler |
| [Tailwind CSS](https://tailwindcss.com/) v4 | Utility-first styling with `dark:` variant |
| [Pinia](https://pinia.vuejs.org/) | State management (API keys, history) |
| [Headless UI](https://headlessui.com/) | Accessible, unstyled UI primitives |
| [@google/genai](https://www.npmjs.com/package/@google/genai) | Google Gemini SDK for streaming generation |
