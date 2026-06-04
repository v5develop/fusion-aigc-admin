// Mock data for system settings

export const mockUnionConfig = {
  baseUrl: 'https://union.example.com',
  appKey: 'app_123456',
  appSecret: 'secret_abcdef',
  tokenUrl: 'https://union.example.com/oauth/token',
  callbackUrl: 'https://admin.example.com/callback',
}

export const mockAIProviderConfig = {
  providers: [
    {
      id: 1,
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-xxxx',
      model: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
      status: 1,
    },
    {
      id: 2,
      name: 'DashScope',
      type: 'dashscope',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-xxxx',
      model: 'qwen-max',
      maxTokens: 8192,
      temperature: 0.5,
      timeout: 60000,
      status: 1,
    },
  ],
}

export const mockStorageConfigs = [
  {
    id: 1,
    name: '默认本地存储',
    type: 'local',
    basePath: './data/media',
    isDefault: true,
    status: 1,
    remark: '开发环境默认本地存储',
    createTime: '2026-05-28T10:00:00',
    updateTime: '2026-05-28T10:00:00',
  },
  {
    id: 2,
    name: '阿里云杭州 OSS',
    type: 's3',
    endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
    bucketName: 'ai-fusion-video',
    accessKey: 'LT****5t',
    secretKey: 'sk****et',
    region: 'cn-hangzhou',
    basePath: 'ai-fusion/',
    customDomain: 'https://cdn.example.com',
    isDefault: false,
    status: 1,
    remark: 'S3 兼容模式接入 OSS',
    createTime: '2026-05-28T10:00:00',
    updateTime: '2026-05-28T10:00:00',
  },
]

export const mockSystemConfig = {
  siteName: 'Fusion AIGC',
  siteBaseUrl: 'https://admin.example.com',
  allowRegister: 'true',
  defaultPoints: '100',
}
