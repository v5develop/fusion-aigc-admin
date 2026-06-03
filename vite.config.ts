import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { mockDevServerPlugin } from "vite-plugin-mock-dev-server";
import { fileURLToPath, URL } from "node:url";
import pkg from "./package.json";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:9090';

  return {
    base: "/",
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
        '^/admin(?:/|$)': {
          target: proxyTarget,
          changeOrigin: true,
          bypass: (req) => {
            const accept = req.headers.accept || ''
            if (accept.includes('text/html')) {
              return '/index.html'
            }
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('Origin')
            })
          },
        },
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
