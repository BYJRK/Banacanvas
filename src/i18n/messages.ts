const messages = {
  en: {
    // Header
    appName: '🍌 Banacanvas',
    beta: 'beta',
    history: 'History',
    apiKeySettings: 'API Key Settings',

    // Footer
    poweredBy: 'Powered by',

    // GenerationPanel
    provider: 'Provider',
    model: 'Model',
    prompt: 'Prompt',
    promptPlaceholder: 'Describe the image you want to generate...',
    referenceImages: 'Reference Images',
    clearAll: 'Clear All',
    dropImages: 'Drop images here or click to upload',
    addMoreImages: 'Add more images',
    generateImage: 'Generate Image',
    editImage: 'Edit Image',
    generating: 'Generating...',
    cancelGeneration: 'Cancel generation',
    fullscreenEdit: 'Fullscreen edit',
    done: 'Done',
    promptCharCount: 'characters',

    // ParameterPanel
    parameters: 'Parameters',
    imageSize: 'Image Size',
    aspectRatio: 'Aspect Ratio',
    thinkingLevel: 'Thinking Level',
    googleSearch: 'Google Search',
    personGeneration: 'Person Generation',
    personAllowAll: 'Allow All',
    personAdultOnly: 'Allow Adults Only',
    personNone: 'None',
    thinkingMinimal: 'Minimal',
    thinkingHigh: 'High',
    outputResolution: 'Output resolution',

    // ImageDisplay
    generatingImage: 'Generating image...',
    download: '⬇ Download',
    fullscreen: '⛶ Fullscreen',
    clear: '✕ Clear',
    emptyState: 'Generated image will appear here',
    inputTokens: 'Input tokens',
    outputTokens: 'Output tokens',
    thinkingTokens: 'Thinking tokens',
    totalTokens: 'Total tokens',
    estimatedCost: 'Estimated cost (USD)',

    // HistoryPanel
    noHistory: 'No history yet',
    justNow: 'Just now',
    timeSuffixMinutes: 'm ago',
    timeSuffixHours: 'h ago',

    // ApiKeyDialog
    apiKeyTitle: 'API Key Settings',
    apiKeyDescription: 'Enter your API keys below. They are stored in your browser\'s localStorage and sent directly to the respective API.',
    apiKeyWarning: '⚠ Your API keys are stored locally and never sent to any third-party server. However, they are visible via browser DevTools.',
    apiKeyLabel: 'Gemini API Key',
    apiKeyPlaceholder: 'AIza...',
    openRouterKeyLabel: 'OpenRouter API Key',
    openRouterKeyPlaceholder: 'sk-or-...',
    clearKey: 'Clear Key',
    cancel: 'Cancel',
    save: 'Save',

    // Toast / Messages
    imageGenerated: 'Image generated!',

    // Errors
    apiKeyNotSet: 'API Key not set',
    generationCancelled: 'Generation cancelled',
    noImageGenerated: 'No image was generated. Try a different prompt.',

    // Providers
    providerGemini: 'Google Gemini',
    providerOpenRouter: 'OpenRouter',
    providerKeyNotSet: 'API key not set for this provider',

    // Models
    modelNanoBanana2: 'Nano Banana 2',
    modelNanoBanana2Desc: 'Best balance of performance & cost. Supports 512–4K, thinking, Google Search.',
    modelNanoBananaPro: 'Nano Banana Pro',
    modelNanoBananaProDesc: 'Professional quality. Advanced reasoning & text rendering.',
    modelORNanoBanana2Desc: 'Gemini Flash via OpenRouter. Supports aspect ratio & image size.',
    modelORNanoBananaProDesc: 'Gemini Pro via OpenRouter. Professional quality.',

    // Theme
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
  },
  zh: {
    // Header
    appName: '🍌 Banacanvas',
    beta: 'beta',
    history: '历史记录',
    apiKeySettings: 'API 密钥设置',

    // Footer
    poweredBy: '由以下技术驱动',

    // GenerationPanel
    provider: '服务商',
    model: '模型',
    prompt: '提示词',
    promptPlaceholder: '描述你想要生成的图片...',
    referenceImages: '参考图片',
    clearAll: '全部清除',
    dropImages: '拖拽图片到此处或点击上传',
    addMoreImages: '添加更多图片',
    generateImage: '生成图片',
    editImage: '编辑图片',
    generating: '生成中...',
    cancelGeneration: '取消生成',
    fullscreenEdit: '全屏编辑',
    done: '完成',
    promptCharCount: '字符',

    // ParameterPanel
    parameters: '参数',
    imageSize: '图片尺寸',
    aspectRatio: '宽高比',
    thinkingLevel: '思考等级',
    googleSearch: 'Google 搜索',
    personGeneration: '人物生成',
    personAllowAll: '允许全部',
    personAdultOnly: '仅允许成人',
    personNone: '不允许',
    thinkingMinimal: '最小',
    thinkingHigh: '高',
    outputResolution: '输出分辨率',

    // ImageDisplay
    generatingImage: '正在生成图片...',
    download: '⬇ 下载',
    fullscreen: '⛶ 全屏',
    clear: '✕ 清除',
    emptyState: '生成的图片将显示在这里',
    inputTokens: '输入 token',
    outputTokens: '输出 token',
    thinkingTokens: '思考 token',
    totalTokens: '总 token',
    estimatedCost: '预估费用（美元）',

    // HistoryPanel
    noHistory: '暂无历史记录',
    justNow: '刚刚',
    timeSuffixMinutes: '分钟前',
    timeSuffixHours: '小时前',

    // ApiKeyDialog
    apiKeyTitle: 'API 密钥设置',
    apiKeyDescription: '输入你的 API 密钥。它们将存储在浏览器的 localStorage 中，并直接发送到对应的 API。',
    apiKeyWarning: '⚠ 你的 API 密钥仅存储在本地，不会发送到任何第三方服务器。但它在浏览器开发者工具中可见。',
    apiKeyLabel: 'Gemini API 密钥',
    apiKeyPlaceholder: 'AIza...',
    openRouterKeyLabel: 'OpenRouter API 密钥',
    openRouterKeyPlaceholder: 'sk-or-...',
    clearKey: '清除密钥',
    cancel: '取消',
    save: '保存',

    // Toast / Messages
    imageGenerated: '图片已生成！',

    // Errors
    apiKeyNotSet: '未设置 API 密钥',
    generationCancelled: '生成已取消',
    noImageGenerated: '未生成图片，请尝试不同的提示词。',

    // Providers
    providerGemini: 'Google Gemini',
    providerOpenRouter: 'OpenRouter',
    providerKeyNotSet: '未设置该服务商的 API 密钥',

    // Models
    modelNanoBanana2: 'Nano Banana 2',
    modelNanoBanana2Desc: '性能与成本的最佳平衡。支持 512–4K、思考、Google 搜索。',
    modelNanoBananaPro: 'Nano Banana Pro',
    modelNanoBananaProDesc: '专业品质。高级推理与文字渲染。',
    modelORNanoBanana2Desc: '通过 OpenRouter 使用 Gemini Flash。支持宽高比和图片尺寸。',
    modelORNanoBananaProDesc: '通过 OpenRouter 使用 Gemini Pro。专业品质。',

    // Theme
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
  },
} as const

export type Locale = keyof typeof messages
export type MessageKey = keyof typeof messages.en
export default messages
