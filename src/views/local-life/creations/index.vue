<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="ph-title">海报 / 长图 / 视频</h2>
      <span class="muted">只读，用于排查用户侧的生成记录</span>
    </div>

    <a-card variant="borderless">
      <a-tabs v-model:active-key="tab" @change="onTabChange">
        <a-tab-pane key="image" tab="海报 / 长图">
          <div class="filter-bar">
            <a-input-number
              v-model:value="imageQuery.userId"
              placeholder="用户 ID"
              :min="1"
              style="width: 160px"
              @change="onImageFilter"
            />
            <a-select
              v-model:value="imageQuery.kind"
              :options="imageKinds"
              style="width: 160px"
              @change="onImageFilter"
            />
            <a-select
              v-model:value="imageQuery.status"
              :options="statusOptions"
              style="width: 140px"
              @change="onImageFilter"
            />
          </div>
          <a-table
            :columns="imageColumns"
            :data-source="imageRows"
            :loading="imageLoading"
            :pagination="false"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'imageUrls'">
                <a-image-preview-group>
                  <img
                    v-for="(src, i) in record.imageUrls"
                    :key="i"
                    :src="src"
                    alt=""
                    class="thumb"
                  />
                </a-image-preview-group>
              </template>
              <template v-else-if="column.dataIndex === 'content'">
                <div class="clamp-2">{{ record.content }}</div>
              </template>
              <template v-else-if="column.dataIndex === 'createTime'">{{
                formatTime(record.createTime)
              }}</template>
            </template>
          </a-table>
          <div class="pager">
            <a-pagination
              v-model:current="imageQuery.page"
              v-model:page-size="imageQuery.pageSize"
              :total="imageTotal"
              show-size-changer
              :page-size-options="['20', '50', '100']"
              @change="loadImages"
              @show-size-change="(_c: number, s: number) => onSize(imageQuery, s, loadImages)"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="video-from-image" tab="数字人口播 / 动作迁移">
          <div class="filter-bar">
            <a-input-number
              v-model:value="videoImageQuery.userId"
              placeholder="用户 ID"
              :min="1"
              style="width: 160px"
              @change="onVideoImageFilter"
            />
            <a-select
              v-model:value="videoImageQuery.kind"
              :options="videoImageKinds"
              style="width: 160px"
              @change="onVideoImageFilter"
            />
            <a-select
              v-model:value="videoImageQuery.status"
              :options="statusOptions"
              style="width: 140px"
              @change="onVideoImageFilter"
            />
          </div>
          <a-table
            :columns="videoImageColumns"
            :data-source="videoImageRows"
            :loading="videoImageLoading"
            :pagination="false"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'videoUrl'">
                <video
                  v-if="record.videoUrl"
                  :src="record.videoUrl"
                  controls
                  preload="metadata"
                  style="height: 120px"
                />
                <span v-else class="muted">-</span>
              </template>
              <template v-else-if="column.dataIndex === 'content'">
                <div class="clamp-2">{{ record.content }}</div>
              </template>
              <template v-else-if="column.dataIndex === 'createTime'">{{
                formatTime(record.createTime)
              }}</template>
            </template>
          </a-table>
          <div class="pager">
            <a-pagination
              v-model:current="videoImageQuery.page"
              v-model:page-size="videoImageQuery.pageSize"
              :total="videoImageTotal"
              show-size-changer
              :page-size-options="['20', '50', '100']"
              @change="loadVideoImages"
              @show-size-change="
                (_c: number, s: number) => onSize(videoImageQuery, s, loadVideoImages)
              "
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="video" tab="探店视频 / 带货短剧">
          <div class="filter-bar">
            <a-input-number
              v-model:value="videoQuery.userId"
              placeholder="用户 ID"
              :min="1"
              style="width: 160px"
              @change="onVideoFilter"
            />
            <a-select
              v-model:value="videoQuery.kind"
              :options="videoKinds"
              style="width: 160px"
              @change="onVideoFilter"
            />
            <a-select
              v-model:value="videoQuery.status"
              :options="statusOptions"
              style="width: 140px"
              @change="onVideoFilter"
            />
          </div>
          <a-table
            :columns="videoColumns"
            :data-source="videoRows"
            :loading="videoLoading"
            :pagination="false"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'videoUrl'">
                <video
                  v-if="record.videoUrl"
                  :src="record.videoUrl"
                  controls
                  preload="metadata"
                  style="height: 120px"
                />
                <span v-else class="muted">-</span>
              </template>
              <template v-else-if="column.dataIndex === 'userText'">
                <div class="clamp-2">{{ record.userText }}</div>
              </template>
              <template v-else-if="column.dataIndex === 'createTime'">{{
                formatTime(record.createTime)
              }}</template>
            </template>
          </a-table>
          <div class="pager">
            <a-pagination
              v-model:current="videoQuery.page"
              v-model:page-size="videoQuery.pageSize"
              :total="videoTotal"
              show-size-changer
              :page-size-options="['20', '50', '100']"
              @change="loadVideos"
              @show-size-change="(_c: number, s: number) => onSize(videoQuery, s, loadVideos)"
            />
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import {
  type CreationItem,
  listCreations,
  listVideoCreations,
  type VideoCreationItem,
} from '@/api/local-life-admin';
import { formatTime } from '@/utils/format';

const tab = ref('image');

// 图片表按媒体类型分两个 tab：海报 / 长图是图片，口播 / 动作迁移的成品是视频（同一张表，见后端 media 过滤）
const imageKinds = [
  { label: '全部类型', value: '' },
  { label: '海报', value: 'poster' },
  { label: '长图', value: 'longImage' },
];
const videoImageKinds = [
  { label: '全部类型', value: '' },
  { label: '数字人口播', value: 'voiceover' },
  { label: '动作迁移', value: 'actionTransfer' },
];
const videoKinds = [
  { label: '全部类型', value: '' },
  { label: '探店视频', value: 'exploreShop' },
  { label: '带货短剧', value: 'shortDrama' },
  { label: '视频复刻', value: 'videoRemake' },
];
const statusOptions = [
  { label: '全部状态', value: -1 },
  { label: '生成中', value: 1 },
  { label: '已完成', value: 2 },
  { label: '失败', value: 3 },
];

interface Query {
  userId: number | null;
  kind: string;
  status: number;
  page: number;
  pageSize: number;
}

const imageQuery = ref<Query>({ userId: null, kind: '', status: -1, page: 1, pageSize: 20 });
const imageRows = ref<CreationItem[]>([]);
const imageLoading = ref(false);
const imageTotal = ref(0);

const videoImageQuery = ref<Query>({ userId: null, kind: '', status: -1, page: 1, pageSize: 20 });
const videoImageRows = ref<CreationItem[]>([]);
const videoImageLoading = ref(false);
const videoImageTotal = ref(0);

const videoQuery = ref<Query>({ userId: null, kind: '', status: -1, page: 1, pageSize: 20 });
const videoRows = ref<VideoCreationItem[]>([]);
const videoLoading = ref(false);
const videoTotal = ref(0);

const imageColumns = [
  { title: '用户', dataIndex: 'userId', width: 90 },
  { title: '类型', dataIndex: 'kind', width: 120 },
  { title: '需求', dataIndex: 'content' },
  { title: '成图', dataIndex: 'imageUrls', width: 260 },
  { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '失败原因', dataIndex: 'failReason', width: 180, ellipsis: true },
  { title: '创建时间', dataIndex: 'createTime', width: 170 },
];

const videoImageColumns = [
  { title: '用户', dataIndex: 'userId', width: 90 },
  { title: '类型', dataIndex: 'kind', width: 120 },
  { title: '文案 / 需求', dataIndex: 'content' },
  { title: '视频', dataIndex: 'videoUrl', width: 240 },
  { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '失败原因', dataIndex: 'failReason', width: 180, ellipsis: true },
  { title: '创建时间', dataIndex: 'createTime', width: 170 },
];

const videoColumns = [
  { title: '用户', dataIndex: 'userId', width: 90 },
  { title: '类型', dataIndex: 'kind', width: 120 },
  { title: '用户输入', dataIndex: 'userText' },
  { title: '卖点', dataIndex: 'sellingPoints', width: 200, ellipsis: true },
  { title: '时长(秒)', dataIndex: 'duration', width: 90, align: 'center' as const },
  { title: '尺寸', dataIndex: 'size', width: 110 },
  { title: '模型', dataIndex: 'model', width: 160 },
  { title: '视频', dataIndex: 'videoUrl', width: 240 },
  { title: '状态', dataIndex: 'status', width: 90, align: 'center' as const },
  { title: '失败原因', dataIndex: 'failReason', width: 180, ellipsis: true },
  { title: '创建时间', dataIndex: 'createTime', width: 170 },
];

function onSize(q: Query, size: number, reload: () => void) {
  q.pageSize = size;
  q.page = 1;
  reload();
}

function onImageFilter() {
  imageQuery.value.page = 1;
  loadImages();
}

function onVideoImageFilter() {
  videoImageQuery.value.page = 1;
  loadVideoImages();
}

function onVideoFilter() {
  videoQuery.value.page = 1;
  loadVideos();
}

function onTabChange(key: string | number) {
  if (key === 'video-from-image' && !videoImageRows.value.length) loadVideoImages();
  if (key === 'video' && !videoRows.value.length) loadVideos();
}

async function loadImages() {
  imageLoading.value = true;
  try {
    const q = imageQuery.value;
    const result = await listCreations({
      userId: q.userId ?? undefined,
      kind: q.kind || undefined,
      media: 'image',
      status: q.status,
      page: q.page,
      pageSize: q.pageSize,
    });
    imageRows.value = result?.list || [];
    imageTotal.value = result?.total || 0;
  } catch {
    /* 已由 API 层提示 */
  } finally {
    imageLoading.value = false;
  }
}

async function loadVideoImages() {
  videoImageLoading.value = true;
  try {
    const q = videoImageQuery.value;
    const result = await listCreations({
      userId: q.userId ?? undefined,
      kind: q.kind || undefined,
      media: 'video',
      status: q.status,
      page: q.page,
      pageSize: q.pageSize,
    });
    videoImageRows.value = result?.list || [];
    videoImageTotal.value = result?.total || 0;
  } catch {
    /* 已由 API 层提示 */
  } finally {
    videoImageLoading.value = false;
  }
}

async function loadVideos() {
  videoLoading.value = true;
  try {
    const q = videoQuery.value;
    const result = await listVideoCreations({
      userId: q.userId ?? undefined,
      kind: q.kind || undefined,
      status: q.status,
      page: q.page,
      pageSize: q.pageSize,
    });
    videoRows.value = result?.list || [];
    videoTotal.value = result?.total || 0;
  } catch {
    /* 已由 API 层提示 */
  } finally {
    videoLoading.value = false;
  }
}

loadImages();
</script>

<style scoped>
.page-container {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.ph-title {
  margin: 0;
  font-size: 18px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  margin-right: 6px;
}
.clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
</style>
