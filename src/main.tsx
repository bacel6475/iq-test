import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소를 찾을 수 없습니다.');

// 기기의 다크 모드 설정을 따른다. (설정 화면에서 직접 고르는 기능은 이후 마일스톤)
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', media.matches);
applyTheme();
media.addEventListener('change', applyTheme);

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
