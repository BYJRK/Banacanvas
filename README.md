# Banacanvas 🍌

English | [中文](./README.zh.md)

A modern web UI for AI image generation powered by Google Gemini Image (aka. Nano Banana). Supports text-to-image, image editing with reference images, multiple API providers, bilingual interface, dark mode, generation history, and real-time cost estimation.

## Features

- **Multi-provider support** — Google Gemini direct API, OpenRouter, and Vercel AI Gateway
- **Text-to-image** — Describe what you want, get an image
- **Image editing** — Upload up to 14 reference images for guided generation/editing
- **Streaming generation** — Real-time feedback as the image is being created
- **Configurable output** — Aspect ratio, image size (512 to 4K), thinking level, Google Search grounding, person generation control
- **Token counting & cost estimation** — Live display of input/output/thinking tokens, elapsed time, and estimated USD cost
- **Generation history** — Auto-saved locally (up to 50 entries), click to restore any previous generation
- **Bilingual UI** — English and Chinese, auto-detected from browser locale
- **Dark mode** — System / Light / Dark, follows OS preference
- **Keyboard shortcut** — <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to generate
- **Drag-to-reorder** — Rearrange reference images by dragging

## Supported Providers & Models

All providers offer the same two underlying Gemini models:

| Model | Internal Name | Resolution | Pricing (per 1M tokens) |
|---|---|---|---|
| **Nano Banana 2** | `gemini-3.1-flash-image-preview` | 512 – 4K | $0.50 input · $3.00 text output · $60 image output |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | 1K – 4K | $2.00 input · $12.00 text output · $120 image output |

| Provider | Description |
|---|---|
| **Gemini** | Direct Google Gemini API. Full feature support including thinking levels, Google Search, and person generation settings. |
| **OpenRouter** | Routes requests through [OpenRouter](https://openrouter.ai). Useful for centralized API key management. |
| **Vercel AI Gateway** | Routes through Vercel's AI infrastructure with optimized delivery. |

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
| Aspect Ratio | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, ... | Flash supports additional ratios (1:4, 1:8, 4:1, 8:1) |
| Image Size | 512, 1K, 2K, 4K | Pro starts at 1K |
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
