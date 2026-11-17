import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router';
import { routes } from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소를 찾을 수 없습니다.');

// 기기의 다크 모드 설정을 따른다. (설정 화면에서 직접 고르는 기능은 이후 마일스톤)
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', media.matches);
applyTheme();
media.addEventListener('change', applyTheme);

// 해시 라우터: 주소가 /#/setup 처럼 되어 GitHub Pages 같은 정적 호스팅에서도 새로고침이 된다.
const router = createHashRouter(routes);

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
