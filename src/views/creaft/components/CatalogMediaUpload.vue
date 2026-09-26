<template>
  <span class="catalog-media-upload">
    <input ref="input" type="file" :accept="accept" hidden @change="onPicked" />
    <a-button :size="size" :loading="uploading" @click="input?.click()">
      {{ uploading ? '上传中' : text }}
    </a-button>
  </span>
</template>

<script setup lang="ts">
import { message } from 'antdv-next';
import { onBeforeUnmount, ref } from 'vue';

import { uploadCatalogMedia } from '@/api/creaft-compat';

/**
 * 目录展示素材的上传按钮：选文件 → 传到系统公有桶 → 把公开地址交给调用方填进表单。
 * 格式与大小由服务端按文件头判定，这里的 accept 只是帮运营少选错。
 */
withDefaults(defineProps<{ accept?: string; text?: string; size?: 'small' | 'middle' }>(), {
  accept: 'image/png,image/jpeg,image/webp,image/gif',
  text: '上传',
  size: 'small',
});
const emit = defineEmits<{ uploaded: [url: string] }>();

const input = ref<HTMLInputElement>();
const uploading = ref(false);
/**
 * 已卸载就不再回传：弹窗关了（表单换成另一条记录）、或取消了「使用上传」，这时回来的地址属于一次已放弃的编辑，
 * 写回去会落进别的记录。文件已经进了桶，这里只能丢弃地址，并提示用户。
 */
let unmounted = false;
onBeforeUnmount(() => {
  unmounted = true;
});

async function onPicked(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  // 清掉选中值：同一个文件连选两次也要能再触发 change
  target.value = '';
  if (!file) return;
  // 先按大小预检，与服务端上限一致（图片、音频 20MB，视频 100MB）：超限就不发请求，免得传完才被拒
  const limitMb = file.type.startsWith('video/') ? 100 : 20;
  if (file.size > limitMb * 1024 * 1024) {
    message.warning(`文件太大：${file.type.startsWith('video/') ? '视频' : '图片和音频'}不能超过 ${limitMb}MB`);
    return;
  }
  uploading.value = true;
  try {
    const url = await uploadCatalogMedia(file);
    if (unmounted) {
      if (url) message.info('上传完成时编辑已关闭，这次上传的地址没有写入表单');
      return;
    }
    if (url) {
      emit('uploaded', url);
      message.success('已上传');
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    if (!unmounted) uploading.value = false;
  }
}
</script>
