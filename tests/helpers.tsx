import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../src/App';

/** 앱 전체를 주어진 주소에서 띄운다. router로 현재 주소를 확인할 수 있다. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router };
}
