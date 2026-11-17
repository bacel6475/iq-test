import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers';

describe('홈 화면', () => {
  it('앱 제목과 시험 시작 버튼이 보인다', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: '추리력 테스트' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '시험 시작' })).toHaveAttribute('href', '/setup');
  });

  it('공인 IQ가 아니라는 안내 문구를 고정 표시한다', async () => {
    renderApp('/');
    expect(await screen.findByText(/공인 IQ가 아니며/)).toBeInTheDocument();
  });
});
