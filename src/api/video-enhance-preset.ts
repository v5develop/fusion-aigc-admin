import type { VideoEnhanceTierPresetMap } from '@/types/api';

import { request } from '@/utils/request';

/**
 * 画质增强（超分）各档位预设。
 *
 * 预设是后台固定参数，用户端只保留分辨率等少量选项。
 * 保存是整表 PUT：必须包含全部四档，任一档不合法则整表拒绝（后端 msg 由拦截器提示）。
 * 写入即时生效，只影响此后的提交，已提交任务不受影响。
 */
export function getVideoEnhanceTierPresets() {
  return request.get<VideoEnhanceTierPresetMap>(
    '/api/v1/admin/settings/video-enhance-tier-presets',
  );
}

export function saveVideoEnhanceTierPresets(data: VideoEnhanceTierPresetMap) {
  return request.put<VideoEnhanceTierPresetMap>(
    '/api/v1/admin/settings/video-enhance-tier-presets',
    data,
  );
}
