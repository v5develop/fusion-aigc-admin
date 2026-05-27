// Mock data for system settings

export const mockUnionConfig = {
  baseUrl: 'https://union.example.com',
  appId: 'app_123456',
  appSecret: 'secret_abcdef',
  tokenUrl: 'https://union.example.com/oauth/token',
  grantUrl: 'https://union.example.com/api/grant',
  revokeUrl: 'https://union.example.com/api/revoke',
  callbackUrl: 'https://admin.example.com/callback',
}

export const mockAIProviderConfig = {
  defaultProvider: 'openai',
  enableRemoteModels: 'true',
}

export const mockStorageConfig = {
  provider: 'aliyun',
  endpoint: 'oss-cn-hangzhou.aliyuncs.com',
  bucket: 'ai-fusion-video',
  accessKey: 'LTAI5t...',
  secretKey: '********',
  domain: 'https://cdn.example.com',
}

export const mockSystemConfig = {
  siteName: 'Fusion AIGC',
  siteBaseUrl: 'https://admin.example.com',
  allowRegister: 'true',
  defaultPoints: '100',
}
