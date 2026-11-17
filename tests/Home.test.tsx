import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from '../src/App';

describe('홈 화면', () => {
  it('앱 제목과 시험 시작 버튼이 보인다', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '추리력 테스트' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시험 시작' })).toBeInTheDocument();
  });

  it('공인 IQ가 아니라는 안내 문구를 고정 표시한다', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(/공인 IQ가 아니며/)).toBeInTheDocument();
  });
});
