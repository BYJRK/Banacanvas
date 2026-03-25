# Project Guidelines — Banacanvas

Google Gemini AI 图像生成 Web UI，支持文生图、图生图编辑、双语(中/英)、暗色模式、生成历史。

## Architecture

- **Stack**: Vue 3 + TypeScript (strict) + Vite 8 + Tailwind CSS v4 + Pinia
- **No router** — 单页面 UI，使用模态框/侧边栏叠加层
- **Components**: `<script setup lang="ts">` SFC，Headless UI 提供无样式可访问组件
- **State**: Pinia stores (`apiKey`, `history`) + 组件内 reactive refs
- **Composables**: `useGemini`(API 调用)、`useI18n`(翻译)、`useTheme`(主题)
- **Types**: 所有接口集中在 `src/types/index.ts`
- **i18n**: 自定义 composable，`MessageKey` 类型约束，支持 `en`/`zh`
- **Storage**: localStorage 存储 API key、主题、语言、历史记录

## Build & Dev

```bash
npm run dev       # Vite 开发服务器
npm run build     # vue-tsc 类型检查 + Vite 生产构建
npm run preview   # 预览生产构建
```

## Code Style

- PascalCase 组件名，camelCase 函数/变量，文件名 camelCase
- 所有组件使用 `<script setup lang="ts">`
- 类型定义统一放在 `src/types/index.ts`，需要时导入
- Tailwind 工具类直接写在模板中，暗色模式用 `dark:` 前缀
- localStorage 读写只在 stores 和 composables 中，不散落在组件里
- 异步函数用 try-catch，错误通过 Toast 和行内消息展示
- i18n 翻译键必须在 `src/i18n/messages.ts` 中定义并使用 `MessageKey` 类型

## Conventions

- 新增翻译时必须同时添加 `en` 和 `zh` 两个语言版本
- 模型配置（支持的尺寸、比例、定价）在 `src/config/models.ts`
- 图片以 base64 存储在 localStorage，历史记录上限 50 条
- Gemini API 使用 streaming 响应，需遍历所有 chunk 获取最终 `usageMetadata`
- 模型切换时需验证并重置不支持的配置项（比例、尺寸）
- 部署到 Vercel，SPA rewrite 规则在 `vercel.json`

## Key Dependencies

| Package | Role |
|---|---|
| `@google/genai` | Google Gemini SDK（streaming 生成 + 图片输入） |
| `@headlessui/vue` | 无样式可访问 UI 组件（Dialog, Listbox, Transition） |
| `pinia` | 状态管理 |
| `tailwindcss` + `@tailwindcss/vite` | CSS 框架（v4） |
