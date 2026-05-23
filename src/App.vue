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
import { theme as antdTheme, type ThemeConfig } from 'antdv-next';
import zhCN from 'antdv-next/locale/zh_CN';
import enUS from 'antdv-next/locale/en_US';
import jaJP from 'antdv-next/locale/ja_JP';
import koKR from 'antdv-next/locale/ko_KR';
import { computed, onMounted } from 'vue';

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
