<template>
  <a-config-provider
    :locale="antdLocale"
    :theme="antdThemeConfig"
    :input="inputConfig"
    :select="selectConfig"
    :date-picker="datePickerConfig"
    :range-picker="datePickerConfig"
  >
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antdv-next';
import zhCN from 'antdv-next/locale/zh_CN';
import enUS from 'antdv-next/locale/en_US';
import jaJP from 'antdv-next/locale/ja_JP';
import koKR from 'antdv-next/locale/ko_KR';
import { computed, onMounted, watchEffect } from 'vue';

import { getLocale } from './locales';
import { appDefaultSettings } from './settings';
import { useSettingsStore } from './stores/settings';
import { useThemeStore } from './stores/theme';

const themeStore = useThemeStore();
const settingsStore = useSettingsStore();

const antdThemeConfig = computed<ThemeConfig>(() => ({
  algorithm: themeStore.isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: settingsStore.primaryColorHex,
    colorLink: settingsStore.primaryColorHex,
  },
}));

const inputConfig = computed(() => appDefaultSettings.input);
const selectConfig = computed(
  () => appDefaultSettings.select as unknown as Record<string, unknown>,
);
const datePickerConfig = computed(
  () => appDefaultSettings.datePicker as unknown as Record<string, unknown>,
);

const LOCALE_MAP: Record<string, any> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR,
};

const antdLocale = computed(() => {
  const locale = getLocale();
  return LOCALE_MAP[locale] || zhCN;
});

/**
 * 把 locale 与 theme 同时喂给 antdv 的全局配置。
 *
 * 上面 <a-config-provider> 只覆盖组件树内部渲染的组件，而
 * Modal.confirm / Modal.warning / message / notification 这些是【静态方法】，
 * 它们把节点挂在组件树之外，拿不到 ConfigProvider 的 context，于是：
 *   - 弹窗标题正文是我们传的中文，按钮却是内置默认值「OK / Cancel」，
 *     一个框里两种语言；
 *   - 深色模式下整个页面是暗的，弹窗却是一块白板。
 *
 * 静态方法内部走 globalConfig()（见 antdv-next/dist/modal/confirm.js），
 * ConfigProvider.config() 正是往那里写。配这一处，全站 28 个静态弹窗一起好；
 * 否则得在每个调用点手写 okText/cancelText，现在已经漏了 17 处，
 * 而且下一个新弹窗照样会忘。
 *
 * setGlobalConfig 只写传进去的字段，不会冲掉没传的 prefixCls 等。
 * 用 watchEffect 而不是只在启动时配一次：切语言、切明暗都要跟着换。
 */
watchEffect(() => {
  ConfigProvider.config({ locale: antdLocale.value, theme: antdThemeConfig.value });
});

onMounted(() => {
  // Initialize theme and settings from localStorage
  themeStore.initTheme()
  settingsStore.initSettings()
})
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
  font-family: var(--font-family);
  color: var(--color-text-primary);
  background-color: var(--color-bg-layout);
}
</style>
