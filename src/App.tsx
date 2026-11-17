import { Outlet, type RouteObject } from 'react-router';
import DevGallery from './pages/DevGallery';
import Home from './pages/Home';
import Result from './pages/Result';
import Setup from './pages/Setup';
import Test from './pages/Test';

/** 모든 화면의 공통 바탕 (라이트/다크) */
function Layout() {
  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Outlet />
    </div>
  );
}

// 시험 중 "뒤로 가기" 확인 창(useBlocker)을 쓰려면 경로를 이렇게 객체로 정의해야 한다.
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/setup', element: <Setup /> },
      { path: '/test/:sessionId', element: <Test /> },
      { path: '/result/:sessionId', element: <Result /> },
      { path: '/dev/gallery', element: <DevGallery /> },
      { path: '*', element: <Home /> },
    ],
  },
];
