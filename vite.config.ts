import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { mockDevServerPlugin } from "vite-plugin-mock-dev-server";
import { fileURLToPath, URL } from "node:url";
import pkg from "./package.json";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:9090';
  // 部署在 /admin/ 二级目录下访问，可通过 VITE_BASE 环境变量覆盖
  const base = env.VITE_BASE || "/admin/";

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      vue(),
      tailwindcss(),
      mockDevServerPlugin({
        prefix: "/api",
        log: "error",
        enabled: env.VITE_USE_MOCK === 'true',
      }),
    ],
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ["legacy-js-api"],
        },
        sass: {
          silenceDeprecations: ["legacy-js-api"],
        },
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      open: false,
      proxy: {
        // 注意：SPA 静态资源由 Vite 通过 base: '/admin/' 直接托管，
        // 不要再对 /admin 做代理，否则会与后端形成重定向循环。
        // 仅代理后端接口前缀 /api。
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('Origin')
            })
          },
        },
      },
    },
    build: {
      target: "es2020",
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/vue/") ||
              id.includes("node_modules/@vue/")
            ) {
              return "vue-vendor";
            }
            if (id.includes("node_modules/vue-router/")) {
              return "vue-router-vendor";
            }
            if (id.includes("node_modules/pinia/")) {
              return "pinia-vendor";
            }
            if (
              id.includes("node_modules/antdv-next/") ||
              id.includes("node_modules/@antdv-next/") ||
              id.includes("node_modules/ant-design-vue/")
            ) {
              return "antdv-vendor";
            }
            if (
              id.includes("node_modules/echarts/") ||
              id.includes("node_modules/vue-echarts/") ||
              id.includes("node_modules/zrender/")
            ) {
              return "chart-vendor";
            }
            if (id.includes("node_modules/dayjs/") || id.includes("node_modules/axios/")) {
              return "utils-vendor";
            }
          },
        },
      },
    },
  };
});
