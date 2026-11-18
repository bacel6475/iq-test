import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  // 상대 경로로 빌드해야 GitHub Pages의 하위 주소(/저장소이름/)에서도 동작한다.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // 설치형 웹앱(PWA): 홈 화면 설치 + 오프라인 동작
    VitePWA({
      disable: mode === 'test',
      registerType: 'autoUpdate',
      injectRegister: false, // 등록은 src/main.tsx에서 직접 한다
      // public/icon.svg 한 장으로 앱 아이콘(PNG 여러 크기)을 빌드할 때 만든다.
      pwaAssets: {
        config: true, // pwa-assets.config.ts
        includeHtmlHeadLinks: true,
        overrideManifestIcons: true,
      },
      manifest: {
        name: '추리력 테스트',
        short_name: '추리력',
        description: '볼 때마다 새로 만들어지는 도형 행렬 추리 문제',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#111111',
      },
      workbox: {
        // 앱을 이루는 모든 파일을 미리 저장해 두어 인터넷 없이도 열린다.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
}));
