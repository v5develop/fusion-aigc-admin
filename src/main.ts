import AntdvNext from 'antdv-next';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

dayjs.locale('zh-cn');

import App from './App.vue';
import { setupDirectives } from './directives';
import i18n from './locales';
import router from './router';
import { useAuthStore } from './stores/auth';
// form-create：JSON 表单渲染器 + 可视化表单设计器（用于 Mode 流的 mode 表单）
import formCreate from '@form-create/ant-design-vue';
import FcDesigner from '@form-create/antd-designer';
// Import global styles
// Tailwind CSS with @layer configuration (must come after reset.css)
import 'antdv-next/dist/reset.css';
import './assets/styles/tailwind.css';
import './assets/styles/variables.css';
import './assets/styles/animations.css';
import './assets/styles/global.css';

const app = createApp(App);

// Global error handler — prevents unhandled errors from crashing the app
app.config.errorHandler = (err, instance, info) => {
  console.error('[Global Error]', err, '\nComponent:', instance, '\nInfo:', info);
};

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  event.preventDefault();
});

// Register plugins
const pinia = createPinia();
app.use(pinia);
app.use(AntdvNext);
app.use(router);
app.use(i18n);
app.use(formCreate);
app.use(FcDesigner);

// Register custom directives
setupDirectives(app);

// Initialize auth
const authStore = useAuthStore();
authStore.initAuth();

app.mount('#app');
