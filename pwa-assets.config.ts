import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// 앱 아이콘 생성 설정. 안드로이드는 "마스커블" 아이콘을 원·둥근 사각형으로 잘라 쓰므로
// 바깥 여백을 아이콘 바탕색(검정)으로 채워 어떤 모양으로 잘려도 자연스럽게 한다.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.25,
      resizeOptions: { background: '#111111' },
    },
  },
  images: ['public/icon.svg'],
});
