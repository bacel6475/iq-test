import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, createSession, getSession } from '../src/db/repo';
import { assembleTest } from '../src/generator/assemble';
import { formatClock } from '../src/scoring';
import { renderApp } from './helpers';

beforeEach(async () => {
  await clearAll();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('시작 → 응답 → 제출 → 결과', () => {
  it.each([
    ['표준형', 60, '40:00'],
    ['고급형', 36, '40:00'],
    ['단축형', 35, '25:00'],
  ])('%s 프리셋으로 시험을 보고 제출할 수 있다', { timeout: 30_000 }, async (name, count, clock) => {
    const user = userEvent.setup();
    const { router } = renderApp('/setup');

    await user.click(await screen.findByRole('radio', { name: new RegExp(name) }));
    await user.click(screen.getByRole('button', { name: '시험 시작' }));

    // 시험 화면: 타이머, 문항 번호, 행렬, 보기 8개
    expect(await screen.findByRole('timer')).toHaveTextContent(new RegExp(`^(${clock}|${clock.slice(0, 2)}:00|\\d\\d:5\\d)$`));
    expect(screen.getByLabelText('현재 문항')).toHaveTextContent(`1 / ${count}`);
    expect(screen.getAllByTestId('matrix-cell')).toHaveLength(8);
    const options = within(screen.getByRole('radiogroup', { name: '보기' })).getAllByRole('radio');
    expect(options).toHaveLength(8);

    // 1번 문항의 정답을 골라 본다 (세션에서 정답 번호를 읽어 옴)
    const sessionId = router.state.location.pathname.split('/').pop() ?? '';
    const session = await getSession(sessionId);
    const answer = session!.items[0].answerIndex;
    await user.click(options[answer]);
    expect(options[answer]).toHaveAttribute('aria-checked', 'true');
    // 답은 고르자마자 저장된다
    await waitFor(async () => expect((await getSession(sessionId))!.responses[0].selected).toBe(answer));

    // 2번 문항으로 갔다가 "다시 보기" 표시
    await user.click(screen.getByRole('button', { name: '다음 →' }));
    expect(screen.getByLabelText('현재 문항')).toHaveTextContent(`2 / ${count}`);
    await user.click(screen.getByRole('button', { name: /다시 보기/ }));

    // 목록 패널에서 상태 확인 후 1번으로 이동
    await user.click(screen.getByRole('button', { name: '목록' }));
    const panel = screen.getByRole('dialog', { name: '문항 목록' });
    expect(within(panel).getByRole('button', { name: '1번 문항 응답함' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: '2번 문항 미응답 다시 보기' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: '1번 문항 응답함' }));
    expect(screen.getByLabelText('현재 문항')).toHaveTextContent(`1 / ${count}`);

    // 제출 확인 창이 미응답 수를 알려 준다
    await user.click(screen.getByRole('button', { name: '제출' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(`${count - 1}개`);
    await user.click(within(dialog).getByRole('button', { name: '제출' }));

    // 결과 화면
    expect(await screen.findByTestId('raw-score')).toHaveTextContent(`1 / ${count}`);
    expect(router.state.location.pathname).toBe(`/result/${sessionId}`);
    expect(screen.getByText(/공인 IQ가 아니며/)).toBeInTheDocument();
    const saved = await getSession(sessionId);
    expect(saved!.status).toBe('submitted');
    expect(saved!.responses[0].isCorrect).toBe(true);
    expect(saved!.responses[0].timeSpentMs).toBeGreaterThanOrEqual(0);
  });

  it('시험 중 뒤로 가기를 하면 확인 창을 띄운다', async () => {
    const user = userEvent.setup();
    const items = assembleTest({ seed: 1, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 10 });
    const { router } = renderApp('/');
    await act(() => router.navigate(`/test/${session.id}`));
    await screen.findByRole('timer');

    await act(() => router.navigate(-1));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('시간은 계속 흐릅니다');
    await user.click(within(dialog).getByRole('button', { name: '계속 풀기' }));
    expect(router.state.location.pathname).toBe(`/test/${session.id}`);
  });
});

/**
 * 시계(Date)와 반복 타이머(setInterval)만 가짜로 바꾼다.
 * DB(가짜 IndexedDB)는 내부적으로 setTimeout을 쓰므로 그것까지 멈추면 저장이 끝나지 않는다.
 */
function useFakeClock(start: number) {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(start);
}

describe('타이머', () => {
  it('남은 시간을 보여 주고, 0이 되면 자동 제출 후 결과 화면으로 간다', async () => {
    const start = new Date('2026-11-17T10:00:00').getTime();
    useFakeClock(start);

    const items = assembleTest({ seed: 2, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 6, now: start });
    const { router } = renderApp(`/test/${session.id}`);

    expect(await screen.findByRole('timer')).toHaveTextContent('06:00');
    expect(screen.getByRole('timer').className).not.toMatch(/orange|red/);

    // 5분 이하: 주황색
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('04:59');
    expect(screen.getByRole('timer').className).toMatch(/orange/);

    // 1분 이하: 빨간색
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * 60_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('00:59');
    expect(screen.getByRole('timer').className).toMatch(/red/);

    // 0초: 자동 제출
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(await screen.findByTestId('raw-score')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/result/${session.id}`);
    const saved = await getSession(session.id);
    expect(saved!.status).toBe('expired');
    expect(saved!.submittedAt).toBe(session.endAt);
  });

  it('화면이 꺼졌다 켜진 경우처럼 타이머가 멈췄다 와도 실제 시각 기준으로 계산한다', async () => {
    const start = new Date('2026-11-17T10:00:00').getTime();
    useFakeClock(start);
    const items = assembleTest({ seed: 3, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 10, now: start });
    renderApp(`/test/${session.id}`);
    expect(await screen.findByRole('timer')).toHaveTextContent('10:00');

    // 타이머 콜백 없이 시계만 3분 17초 흐름 (화면이 꺼져 브라우저가 타이머를 멈춘 상황)
    vi.setSystemTime(start + 197_000);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByRole('timer')).toHaveTextContent(formatClock(600_000 - 197_000));
  });

  it('연습 모드는 타이머 없이 진행된다', async () => {
    const items = assembleTest({ seed: 4, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'custom', mode: 'practice', items, minutes: 10 });
    renderApp(`/test/${session.id}`);
    expect(await screen.findByText('연습')).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(session.endAt).toBeNull();
  });
});
