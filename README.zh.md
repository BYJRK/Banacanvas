# Banacanvas 🍌

[English](./README.md) | 中文

基于 Google Gemini Image（即 Nano Banana）的 AI 图像生成的网页应用。支持文生图、图生图编辑、多 API 提供商、中英双语界面、暗色模式、生成历史记录和实时费用估算。

## 功能特性

- **多提供商支持** — Google Gemini 直连 API、OpenRouter、Vercel AI Gateway
- **文生图** — 描述你想要的画面，AI 为你生成
- **图生图编辑** — 上传最多 14 张参考图，引导生成/编辑
- **流式生成** — 实时反馈生成进度
- **灵活配置** — 宽高比、图片尺寸（512 到 4K）、思考级别、Google 搜索增强、人物生成控制
- **Token 计数与费用估算** — 实时显示输入/输出/思考 Token 数、耗时及预估美元费用
- **生成历史** — 自动本地保存（最多 50 条），点击即可恢复之前的生成结果
- **中英双语 UI** — 根据浏览器语言自动检测
- **暗色模式** — 跟随系统 / 浅色 / 深色
- **快捷键** — <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 生成
- **拖拽排序** — 拖动调整参考图顺序

## 支持的提供商与模型

所有提供商均提供相同的两个底层 Gemini 模型：

| 模型 | 内部名称 | 分辨率 | 定价（每 1M Token） |
|---|---|---|---|
| **Nano Banana 2** | `gemini-3.1-flash-image-preview` | 512 – 4K | $0.50 输入 · $3.00 文本输出 · $60 图像输出 |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | 1K – 4K | $2.00 输入 · $12.00 文本输出 · $120 图像输出 |

| 提供商 | 说明 |
|---|---|
| **Gemini** | 直连 Google Gemini API。完整功能支持，包括思考级别、Google 搜索和人物生成设置。 |
| **OpenRouter** | 通过 [OpenRouter](https://openrouter.ai) 中转。适合统一管理 API 密钥。 |
| **Vercel AI Gateway** | 通过 Vercel AI 基础设施中转，优化传输。 |

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 18+

### 安装

```bash
npm install
```

### 开发

```bash
npm run dev
```

在 `http://localhost:5173` 启动，支持热更新。

### 生产构建

```bash
npm run build    # 类型检查 (vue-tsc) + Vite 生产构建 → dist/
npm run preview  # 本地预览生产构建
```

## 使用方法

### API 密钥（BYOK）

自带密钥。点击页面顶部的 **⚙** 图标，输入你要使用的提供商密钥。密钥仅存储在浏览器本地，不会发送到任何第三方服务器。

| 提供商 | 获取密钥 |
|---|---|
| Gemini | [Google AI Studio](https://aistudio.google.com/apikey) |
| OpenRouter | [OpenRouter Keys](https://openrouter.ai/keys) |
| Vercel AI | [Vercel Dashboard](https://vercel.com) |

### 生成图片

1. 选择 **提供商** 和 **模型**
2. 输入描述你想要的图片的提示词
3. *（可选）* 上传参考图进行图生图编辑
4. 调整设置 — 宽高比、图片尺寸、思考级别等
5. 点击 **生成**（或按 <kbd>Ctrl</kbd>+<kbd>Enter</kbd>）
6. 查看结果，下载或全屏查看

### 配置选项

| 选项 | 可选值 | 备注 |
|---|---|---|
| 宽高比 | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, ... | Flash 额外支持 1:4, 1:8, 4:1, 8:1 |
| 图片尺寸 | 512, 1K, 2K, 4K | Pro 最小为 1K |
| 思考级别 | Minimal, High | 仅 Gemini 提供商；影响推理深度和费用 |
| Google 搜索 | 开 / 关 | 仅 Gemini 提供商；启用网络搜索增强生成 |
| 人物生成 | 全部允许 / 仅成人 / 禁止 | 仅 Gemini 提供商 |

## 技术栈

| 依赖 | 用途 |
|---|---|
| [Vue 3](https://vuejs.org/) | UI 框架（Composition API，`<script setup>` SFC） |
| [TypeScript](https://www.typescriptlang.org/) 5.9 | 严格类型检查 |
| [Vite](https://vite.dev/) 8 | 开发服务器与构建工具 |
| [Tailwind CSS](https://tailwindcss.com/) v4 | 原子化 CSS，支持 `dark:` 变体 |
| [Pinia](https://pinia.vuejs.org/) | 状态管理（API 密钥、历史记录） |
| [Headless UI](https://headlessui.com/) | 无样式可访问 UI 组件 |
| [@google/genai](https://www.npmjs.com/package/@google/genai) | Google Gemini SDK，流式生成 |
