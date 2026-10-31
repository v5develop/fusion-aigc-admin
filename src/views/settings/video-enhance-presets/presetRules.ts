/**
 * 画质增强档位预设的前端校验（纯函数，仅作体验层校验）。
 *
 * 权威规则在后端 VideoEnhancePresetRules：每档允许的参数白名单、取值范围、枚举、codec/bit_depth 组合。
 * 这里照其镜像，只为在提交前给出即时提示；保存时后端仍会整表重新校验，并以其 msg 为准。
 * 不要在这里放宽后端白名单。
 */
import type {
  VideoEnhanceTier,
  VideoEnhanceTierPreset,
  VideoEnhanceTierPresetMap,
} from '@/types/api';

export const VIDEO_ENHANCE_TIERS: readonly VideoEnhanceTier[] = [
  'fast',
  'standard',
  'professional',
  'generative',
];

export type VideoEnhanceParam = keyof VideoEnhanceTierPreset;

export interface IntRange {
  min: number;
  max: number;
}

export interface TierRule {
  /** 该档允许的预设参数（白名单） */
  params: readonly VideoEnhanceParam[];
  /** 该档可选分辨率（用户选择，不进预设，仅用于说明） */
  resolutions: readonly string[];
  ranges: Partial<Record<VideoEnhanceParam, IntRange>>;
  enums: Partial<Record<VideoEnhanceParam, readonly (string | number)[]>>;
}

const BITRATE_LEVELS = ['low', 'medium', 'high'];
const ENHANCE_STYLES = ['hd', 'natural'];
const SCENES = ['aigc', 'short_series', 'ugc', 'old_film'];
const BIT_DEPTHS: readonly number[] = [8, 10, 12, 16];
const BITRATE_RANGE: IntRange = { min: 10, max: 150000 };
/** 极速版（官方：720p / 1080p / 4k） */
const RES_FAST = ['720p', '1080p', '4k'];
/** 标准版、专业版（官方：720p / 1080p / 4k / 6k / 8k） */
const RES_STANDARD = ['720p', '1080p', '4k', '6k', '8k'];

/** 编码 → 允许的色深（与后端 CODEC_DEPTHS 一致） */
export const CODEC_BIT_DEPTHS: Readonly<Record<string, readonly number[]>> = {
  h264: [8],
  h265: [8, 10, 12],
  prores: [10],
  ffv1: [16],
  exr: [16],
};

/** 16 位色深仅支持不超过该秒数的输入（后端在提交时校验，这里只做提示） */
export const BIT_DEPTH_16_MAX_SECONDS = 40;

export const VIDEO_ENHANCE_TIER_RULES: Readonly<Record<VideoEnhanceTier, TierRule>> = {
  fast: {
    params: ['resolution_limit', 'fps', 'bitrate_level', 'bitrate'],
    resolutions: RES_FAST,
    ranges: {
      resolution_limit: { min: 128, max: 2160 },
      fps: { min: 15, max: 120 },
      bitrate: BITRATE_RANGE,
    },
    enums: { bitrate_level: BITRATE_LEVELS },
  },
  standard: {
    params: ['enhance_style', 'scene', 'resolution_limit', 'fps', 'bitrate_level', 'bitrate'],
    resolutions: RES_STANDARD,
    ranges: {
      resolution_limit: { min: 128, max: 4320 },
      fps: { min: 1, max: 120 },
      bitrate: BITRATE_RANGE,
    },
    enums: { enhance_style: ENHANCE_STYLES, scene: SCENES, bitrate_level: BITRATE_LEVELS },
  },
  professional: {
    params: [
      'enhance_style',
      'resolution_limit',
      'fps',
      'bit_depth',
      'codec',
      'bitrate_level',
      'bitrate',
    ],
    resolutions: RES_STANDARD,
    ranges: {
      resolution_limit: { min: 128, max: 4320 },
      fps: { min: 1, max: 120 },
      bitrate: BITRATE_RANGE,
    },
    enums: {
      enhance_style: ENHANCE_STYLES,
      bit_depth: BIT_DEPTHS,
      codec: Object.keys(CODEC_BIT_DEPTHS).sort(),
      bitrate_level: BITRATE_LEVELS,
    },
  },
  generative: {
    params: ['fps', 'bitrate_level', 'bitrate'],
    resolutions: ['720p', '1080p', '2k', '4k'],
    ranges: {
      fps: { min: 1, max: 120 },
      bitrate: BITRATE_RANGE,
    },
    enums: { bitrate_level: BITRATE_LEVELS },
  },
};

export type PresetIssue =
  | { field: VideoEnhanceParam; reason: 'unsupported' }
  | { field: VideoEnhanceParam; reason: 'integer' }
  | { field: VideoEnhanceParam; reason: 'range'; min: number; max: number }
  | { field: VideoEnhanceParam; reason: 'enum'; options: readonly (string | number)[] }
  | {
      field: 'codec';
      reason: 'combination';
      codec: string;
      bitDepth: number;
      allowed: readonly number[];
    };

/** 留空判断：undefined / null / 空串都视为「不设预设」 */
export function isPresetValueSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/** 某档在给定 codec 下可选的色深（codec 为空或未知时返回全部色深） */
export function allowedBitDepths(codec?: string): readonly number[] {
  if (codec && CODEC_BIT_DEPTHS[codec]) {
    return CODEC_BIT_DEPTHS[codec];
  }
  return BIT_DEPTHS;
}

/**
 * 校验单档预设：参数白名单、整数范围、枚举、codec/bit_depth 组合。
 * 只校验已填写的字段；留空不报错。只给 codec 而未给色深时不在此拒绝（后端提交时补全或拒绝）。
 */
export function validateTierPreset(
  tier: VideoEnhanceTier,
  preset: VideoEnhanceTierPreset,
): PresetIssue[] {
  const rule = VIDEO_ENHANCE_TIER_RULES[tier];
  const issues: PresetIssue[] = [];

  (Object.keys(preset) as VideoEnhanceParam[]).forEach((field) => {
    const value = preset[field];
    if (!isPresetValueSet(value)) {
      return;
    }
    if (!rule.params.includes(field)) {
      issues.push({ field, reason: 'unsupported' });
      return;
    }
    const range = rule.ranges[field];
    if (range) {
      const n = Number(value);
      if (!Number.isInteger(n)) {
        issues.push({ field, reason: 'integer' });
      } else if (n < range.min || n > range.max) {
        issues.push({ field, reason: 'range', min: range.min, max: range.max });
      }
    }
    const options = rule.enums[field];
    if (options && !options.some((option) => String(option) === String(value))) {
      issues.push({ field, reason: 'enum', options });
    }
  });

  const { codec, bit_depth: bitDepth } = preset;
  if (isPresetValueSet(codec) && isPresetValueSet(bitDepth)) {
    const allowed = CODEC_BIT_DEPTHS[String(codec)];
    if (allowed && !allowed.includes(Number(bitDepth))) {
      issues.push({
        field: 'codec',
        reason: 'combination',
        codec: String(codec),
        bitDepth: Number(bitDepth),
        allowed,
      });
    }
  }
  return issues;
}

/** 整表校验，返回有问题的档位及其问题列表（全部合法则返回空数组） */
export function validatePresetMap(
  presets: VideoEnhanceTierPresetMap,
): { tier: VideoEnhanceTier; issues: PresetIssue[] }[] {
  return VIDEO_ENHANCE_TIERS.map((tier) => ({
    tier,
    issues: validateTierPreset(tier, presets[tier] ?? {}),
  })).filter((item) => item.issues.length > 0);
}

/**
 * 组装保存请求体：四档齐全；只保留已填写且属于该档白名单的字段；留空字段不写入。
 * 数值字段保持为 number，枚举保持为字符串。
 */
export function buildPresetPayload(
  form: Readonly<Record<VideoEnhanceTier, VideoEnhanceTierPreset>>,
): VideoEnhanceTierPresetMap {
  const payload = {} as VideoEnhanceTierPresetMap;
  for (const tier of VIDEO_ENHANCE_TIERS) {
    const rule = VIDEO_ENHANCE_TIER_RULES[tier];
    const out: Record<string, unknown> = {};
    for (const field of rule.params) {
      const value = form[tier]?.[field];
      if (isPresetValueSet(value)) {
        out[field] = value;
      }
    }
    payload[tier] = out as VideoEnhanceTierPreset;
  }
  return payload;
}

/** 从接口返回体里只取某档白名单内的字段（防止未知字段进入表单） */
export function pickTierPreset(
  tier: VideoEnhanceTier,
  preset: VideoEnhanceTierPreset | undefined,
): VideoEnhanceTierPreset {
  const out: Record<string, unknown> = {};
  for (const field of VIDEO_ENHANCE_TIER_RULES[tier].params) {
    const value = preset?.[field];
    if (isPresetValueSet(value)) {
      out[field] = value;
    }
  }
  return out as VideoEnhanceTierPreset;
}
