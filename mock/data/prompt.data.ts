// Mock data for prompt management module

export interface MockPromptVariable {
  name: string;
  label?: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface MockPromptSlotOption {
  label: string;
  value: string;
}

export interface MockPromptSlot {
  key: string;
  slotType: 'text' | 'select' | 'image' | 'chip' | 'number';
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: MockPromptSlotOption[];
  multiple?: boolean;
  maxCount?: number;
  recommendedSize?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface MockPromptRecord {
  id: string;
  name: string;
  code?: string;
  category?: string;
  description?: string;
  icon?: string;
  coverImage?: string;
  content: string;
  slots?: MockPromptSlot[];
  variables?: MockPromptVariable[];
  tags?: string[];
  version?: number;
  usageCount?: number;
  enabled?: number;
  sort?: number;
  createTime?: string;
  updateTime?: string;
}

export const mockPrompts: MockPromptRecord[] = [
  {
    id: 'prompt_ecom_main',
    name: '电商主图直出',
    code: 'ecommerce_main_image_agent',
    category: 'ecommerce',
    description: '上传产品图，一键生成电商主图（高级占位组件版）',
    icon: 'PictureOutlined',
    coverImage: 'https://placehold.co/120x120?text=主图',
    content:
      '{{productImage}}，生成电商主图（{{count}}），商品名称是{{productName}}，卖点是{{sellingPoint}}，坐垫可拆洗，风格是居家治愈风，适配{{platform}}平台，主图比例为{{ratio}}',
    slots: [
      {
        key: 'productImage',
        slotType: 'image',
        label: '点击上传产品图',
        maxCount: 1,
        recommendedSize: '1:1',
      },
      {
        key: 'count',
        slotType: 'select',
        label: '生成数量',
        defaultValue: '1张',
        options: [
          { label: '1张', value: '1张' },
          { label: '4张', value: '4张' },
          { label: '8张', value: '8张' },
        ],
      },
      {
        key: 'productName',
        slotType: 'text',
        label: '商品名称',
        placeholder: '单人沙发',
        required: true,
      },
      { key: 'sellingPoint', slotType: 'text', label: '卖点', placeholder: '亲肤面料' },
      {
        key: 'platform',
        slotType: 'select',
        label: '平台',
        defaultValue: '淘宝/天猫',
        options: [
          { label: '淘宝/天猫', value: '淘宝/天猫' },
          { label: '京东', value: '京东' },
          { label: '拼多多', value: '拼多多' },
        ],
      },
      {
        key: 'ratio',
        slotType: 'select',
        label: '主图比例',
        defaultValue: '1:1',
        options: [
          { label: '1:1', value: '1:1' },
          { label: '3:4', value: '3:4' },
          { label: '9:16', value: '9:16' },
        ],
      },
    ],
    tags: ['电商', '主图', 'Agent'],
    version: 1,
    usageCount: 0,
    enabled: 1,
    sort: 10,
    createTime: '2025-03-10T09:30:00',
    updateTime: '2025-03-10T09:30:00',
  },
  {
    id: 'prompt_001',
    name: '电商主图文案生成',
    code: 'ecommerce_main_image',
    category: 'ecommerce',
    description: '根据商品信息生成吸引眼球的电商主图文案',
    content:
      '你是一名资深电商文案专家。请根据以下商品信息生成 {{count}} 条主图文案：\n商品名称：{{productName}}\n卖点：{{sellingPoints}}\n风格：{{style}}\n要求：简洁有力，突出卖点。',
    variables: [
      { name: 'productName', label: '商品名称', required: true },
      { name: 'sellingPoints', label: '卖点', description: '逗号分隔', required: true },
      { name: 'style', label: '风格', defaultValue: '活泼' },
      { name: 'count', label: '生成数量', defaultValue: '3' },
    ],
    tags: ['电商', '文案'],
    version: 2,
    usageCount: 128,
    enabled: 1,
    sort: 1,
    createTime: '2025-02-10T09:30:00',
    updateTime: '2025-03-01T14:20:00',
  },
  {
    id: 'prompt_002',
    name: '短视频脚本生成',
    code: 'short_video_script',
    category: 'video',
    description: '生成 15-30 秒短视频分镜脚本',
    content:
      '请为主题「{{topic}}」生成一个时长约 {{duration}} 秒的短视频脚本，目标受众：{{audience}}。包含分镜、台词与画面描述。',
    variables: [
      { name: 'topic', label: '主题', required: true },
      { name: 'duration', label: '时长(秒)', defaultValue: '20' },
      { name: 'audience', label: '目标受众', defaultValue: '年轻群体' },
    ],
    tags: ['视频', '脚本'],
    version: 1,
    usageCount: 56,
    enabled: 1,
    sort: 2,
    createTime: '2025-02-18T11:00:00',
    updateTime: '2025-02-18T11:00:00',
  },
  {
    id: 'prompt_003',
    name: '图片风格描述词',
    code: 'image_style_prompt',
    category: 'image',
    description: '将自然语言描述转换为 AI 绘图提示词',
    content:
      '将以下描述转换为高质量 AI 绘图提示词（英文）：\n描述：{{description}}\n风格：{{artStyle}}\n输出包含主体、环境、光照、镜头等关键词。',
    variables: [
      { name: 'description', label: '描述', required: true },
      { name: 'artStyle', label: '艺术风格', defaultValue: '写实' },
    ],
    tags: ['图片', '绘图'],
    version: 3,
    usageCount: 240,
    enabled: 0,
    sort: 3,
    createTime: '2025-01-20T08:15:00',
    updateTime: '2025-03-10T16:45:00',
  },
];
