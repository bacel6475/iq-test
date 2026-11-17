import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { generateItem } from '../src/generator';
import { Matrix } from '../src/render/Matrix';

describe('행렬 렌더러', () => {
  it('8칸을 그리고 마지막 칸은 빈칸(?)으로 둔다', () => {
    const spec = generateItem(3, 4);
    render(<Matrix cells={spec.cells} />);
    expect(screen.getAllByTestId('matrix-cell')).toHaveLength(8);
    expect(screen.getByTestId('matrix-blank')).toHaveTextContent('?');
  });

  it('모든 레벨의 문항이 오류 없이 그려진다', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const { container, unmount } = render(<Matrix cells={generateItem(seed, level).cells} />);
        expect(container.querySelectorAll('svg path').length).toBeGreaterThanOrEqual(8);
        unmount();
      }
    }
  });
});

describe('개발용 갤러리', () => {
  it('문항 50개를 정답 표시와 함께 보여 주고 레벨을 바꿀 수 있다', async () => {
    render(
      <MemoryRouter initialEntries={['/dev/gallery']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId('gallery-item')).toHaveLength(50);
    expect(document.querySelectorAll('[data-answer]')).toHaveLength(50);
    expect(screen.queryByText('검증 실패')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/레벨 5/)).toHaveLength(50);
  });
});
