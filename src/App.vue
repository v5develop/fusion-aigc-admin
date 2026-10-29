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
// 深引入：changeConfirmLocale 没有从包入口导出，但它是静态弹窗文案的唯一兜底来源，
// 见下面 syncAntdGlobalConfig 的说明。升级 antdv-next 时若这条路径没了，
// 表现是弹窗按钮变回 OK/Cancel（不会编译报错），届时按同样思路重新接一次。
import { changeConfirmLocale } from 'antdv-next/dist/modal/locale';
import enUS from 'antdv-next/locale/en_US';
import jaJP from 'antdv-next/locale/ja_JP';
import koKR from 'antdv-next/locale/ko_KR';
import zhCN from 'antdv-next/locale/zh_CN';
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

const LOCALE_MAP: Record<string, typeof zhCN> = {
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
 *
 * 光配 ConfigProvider.config 还不够，必须同时调 changeConfirmLocale：
 * 弹窗文案实际取自 useLocale("Modal", getConfirmLocale())——context 里有就用
 * context，没有就用 getConfirmLocale() 的返回值，而那个值初始化成 en_US
 * 且【库里没有任何地方调用 changeConfirmLocale 去改它】（在 dist 里搜过，零调用）。
 * 也就是说这个兜底永远是英文，只要 context 那一路没接上就露出 OK/Cancel。
 * 两条路都设成同一份 locale，无论走哪条结果都一样。
 */
watchEffect((onCleanup) => {
  ConfigProvider.config({ locale: antdLocale.value, theme: antdThemeConfig.value });
  // changeConfirmLocale 是「往列表里追加一份并返回撤销函数」，不是覆盖式赋值。
  // 这个 effect 切主题也会重跑，不撤销的话列表会一直涨。
  const restore = changeConfirmLocale(antdLocale.value.Modal);
  onCleanup(() => restore?.());
});

onMounted(() => {
  // Initialize theme and settings from localStorage
  themeStore.initTheme();
  settingsStore.initSettings();
});
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
