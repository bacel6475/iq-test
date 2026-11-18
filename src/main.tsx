import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { routes } from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소를 찾을 수 없습니다.');

// 기기의 다크 모드 설정을 따른다. (설정 화면에서 직접 고르는 기능은 이후 마일스톤)
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', media.matches);
applyTheme();
media.addEventListener('change', applyTheme);

// 저장 공간이 부족할 때 브라우저가 기록을 지우지 않도록 "영구 저장"을 요청한다 (거절돼도 앱은 동작).
void navigator.storage?.persist?.().catch(() => false);

// 오프라인용 서비스 워커 등록. 새 버전이 올라오면 다음에 앱을 열 때 자동으로 바뀐다.
// (시험 중이어도 답과 남은 시간은 저장되어 있으므로 화면이 새로 고쳐져도 이어서 풀 수 있다.)
registerSW({ immediate: true });

// 해시 라우터: 주소가 /#/setup 처럼 되어 GitHub Pages 같은 정적 호스팅에서도 새로고침이 된다.
const router = createHashRouter(routes);

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
