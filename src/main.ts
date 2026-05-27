import AntdvNext from 'antdv-next';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

dayjs.locale('zh-cn');

import App from './App.vue';
import { registerDefaultComponentProps } from './components/Global/defaultComponentProps';
import { setupDirectives } from './directives';
import i18n from './locales';
import router from './router';
import { useAuthStore } from './stores/auth';
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
registerDefaultComponentProps(app);

// Register custom directives
setupDirectives(app);

// Initialize auth
const authStore = useAuthStore();
authStore.initAuth();

app.mount('#app');
