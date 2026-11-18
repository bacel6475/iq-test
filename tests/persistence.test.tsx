import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  createSession,
  expireOverdueSessions,
  finishSession,
  getSession,
  getUsedSignatures,
  updateResponse,
} from '../src/db/repo';
import { db } from '../src/db/schema';
import { itemSignature } from '../src/generator';
import { assembleTest } from '../src/generator/assemble';
import { renderApp } from './helpers';

beforeEach(async () => {
  await clearAll();
});

afterEach(() => {
  vi.useRealTimers();
});

/** 앱을 껐다 켠 것처럼 DB 연결을 닫았다가 다시 연다 (저장된 내용은 IndexedDB에 남아 있다). */
async function reopenDb() {
  db.close();
  await db.open();
}

describe('저장과 세션 복구', () => {
  it('시험 중 새로고침해도 답·다시 보기 표시·보던 문항·남은 시간이 유지된다', async () => {
    const start = new Date('2026-11-18T09:00:00').getTime();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(start);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const items = assembleTest({ seed: 11, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 10, now: start });
    const first = renderApp(`/test/${session.id}`);
    await screen.findByRole('timer');

    // 1번에 답하고, 2번에 다시 보기 표시, 3번으로 이동
    await user.click(within(screen.getByRole('radiogroup')).getAllByRole('radio')[4]);
    await user.click(screen.getByRole('button', { name: '다음 →' }));
    await user.click(screen.getByRole('button', { name: /다시 보기/ }));
    await user.click(screen.getByRole('button', { name: '다음 →' }));
    expect(screen.getByLabelText('현재 문항')).toHaveTextContent('3 / 10');

    // 2분 34초가 흐른 뒤 새로고침
    await act(async () => {
      await vi.advanceTimersByTimeAsync(154_000);
    });
    first.unmount();
    // 화면을 닫을 때 남기는 "머문 시간" 기록이 끝나기를 기다린다.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await reopenDb();
    renderApp(`/test/${session.id}`);

    expect(await screen.findByLabelText('현재 문항')).toHaveTextContent('3 / 10');
    expect(screen.getByRole('timer')).toHaveTextContent('07:26');
    await user.click(screen.getByRole('button', { name: '목록' }));
    const panel = screen.getByRole('dialog', { name: '문항 목록' });
    expect(within(panel).getByRole('button', { name: '1번 문항 응답함' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: '2번 문항 미응답 다시 보기' })).toBeInTheDocument();

    const saved = await getSession(session.id);
    expect(saved!.responses[0].selected).toBe(4);
    // 3번 문항에 2분 34초 머문 것이 기록되었다
    expect(saved!.responses[2].timeSpentMs).toBe(154_000);
  });

  it('앱을 다시 열었을 때 시간이 지났으면 저장된 답으로 채점해 시간 종료로 기록한다', async () => {
    const start = new Date('2026-11-18T09:00:00').getTime();
    const items = assembleTest({ seed: 12, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 10, now: start });
    await updateResponse(session.id, 0, { selected: items[0].answerIndex });
    await updateResponse(session.id, 1, { selected: (items[1].answerIndex + 1) % 8 });

    // 아직 시간이 남았으면 그대로
    await expireOverdueSessions(start + 9 * 60_000);
    expect((await getSession(session.id))!.status).toBe('active');

    await reopenDb();
    await expireOverdueSessions(start + 30 * 60_000);
    const saved = await getSession(session.id);
    expect(saved!.status).toBe('expired');
    expect(saved!.rawScore).toBe(1);
    expect(saved!.submittedAt).toBe(session.endAt);
    expect(saved!.responses.map((r) => r.isCorrect).slice(0, 3)).toEqual([true, false, false]);
  });

  it('홈 화면은 시간이 남은 진행 중 시험을 이어서 풀 수 있게 안내한다', async () => {
    const items = assembleTest({ seed: 13, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'quick-35', mode: 'timed', items, minutes: 25 });
    renderApp('/');
    expect(await screen.findByText('진행 중인 시험이 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이어서 풀기' })).toHaveAttribute('href', `/test/${session.id}`);
  });

  it('끝난 시험의 답은 더 이상 바뀌지 않는다', async () => {
    const items = assembleTest({ seed: 14, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 10 });
    await finishSession(session.id, 'submitted');
    await updateResponse(session.id, 0, { selected: 3 });
    expect((await getSession(session.id))!.responses[0].selected).toBeNull();
  });
});

describe('중복 방지', () => {
  it('같은 시드로 시험지를 20개 연속 만들어도 서명 중복이 0건이다', { timeout: 120_000 }, async () => {
    for (let n = 0; n < 20; n++) {
      const used = await getUsedSignatures();
      // 일부러 매번 같은 시드를 써서, DB 대조가 없으면 같은 문항이 나오는 조건을 만든다.
      const items = assembleTest({ seed: 777, count: 35, levelRange: [1, 5], isUsed: (s) => used.has(s) });
      await createSession({ presetId: 'quick-35', mode: 'timed', items, minutes: 25 });
    }
    const rows = await db.items.toArray();
    expect(rows).toHaveLength(20 * 35);
    expect(new Set(rows.map((r) => r.signature)).size).toBe(rows.length);
    // 저장된 서명이 실제 명세에서 계산한 서명과 같다
    for (const row of rows.slice(0, 50)) expect(row.signature).toBe(itemSignature(row.spec));
  });

  it('시험 설정 화면에서 시작한 시험지는 이전 시험의 문항을 다시 넣지 않는다', { timeout: 30_000 }, async () => {
    const user = userEvent.setup();
    const old = assembleTest({ seed: 1, count: 10, levelRange: [1, 5] });
    const prev = await createSession({ presetId: 'custom', mode: 'timed', items: old, minutes: 10 });
    await finishSession(prev.id, 'submitted');
    const before = await getUsedSignatures();

    const { router } = renderApp('/setup');
    await user.click(await screen.findByRole('radio', { name: /단축형/ }));
    await user.click(screen.getByRole('button', { name: '시험 시작' }));
    await screen.findByRole('timer');

    const id = router.state.location.pathname.split('/').pop() ?? '';
    const created = await getSession(id);
    for (const item of created!.items) expect(before.has(itemSignature(item))).toBe(false);
  });
});

describe('결과·기록 화면', () => {
  it('결과 화면에 레벨별 정답률, 문항별 복기와 규칙 해설이 나온다', async () => {
    const user = userEvent.setup();
    const items = assembleTest({ seed: 21, count: 10, levelRange: [1, 5] });
    const session = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 10 });
    await updateResponse(session.id, 0, { selected: items[0].answerIndex });
    await updateResponse(session.id, 1, { selected: (items[1].answerIndex + 1) % 8 });
    await finishSession(session.id, 'submitted');

    renderApp(`/result/${session.id}`);
    expect(await screen.findByTestId('raw-score')).toHaveTextContent('1 / 10');
    expect(screen.getByRole('list', { name: '레벨별 정답률' })).toHaveTextContent('레벨 1');
    expect(screen.getByRole('img', { name: '문항별 소요 시간 막대 그래프' })).toBeInTheDocument();
    expect(screen.getByText(/공인 IQ가 아니며/)).toBeInTheDocument();

    // 1번 문항 복기: 정답 표시와 규칙 해설
    const review = screen.getByTestId('review-item');
    expect(review).toHaveTextContent('1번');
    expect(review).toHaveTextContent('✓ 정답·내 답');
    expect(within(review).getByTestId('matrix-answer')).toBeInTheDocument();
    expect(within(review).getByTestId('rules')).toHaveTextContent(/(모양|크기|채움|방향|개수): /);

    // 오답만 거르면 2번이 나오고 내 답이 표시된다
    await user.click(screen.getByRole('button', { name: /^오답/ }));
    expect(screen.getByTestId('review-item')).toHaveTextContent('2번');
    expect(screen.getByTestId('review-item')).toHaveTextContent('✗ 내 답');
  });

  it('기록 화면에 끝난 시험 목록과 정답률 추세가 나온다', async () => {
    for (let n = 0; n < 3; n++) {
      const items = assembleTest({ seed: 30 + n, count: 10, levelRange: [1, 5] });
      const s = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 10, now: Date.now() + n });
      for (let i = 0; i <= n; i++) await updateResponse(s.id, i, { selected: items[i].answerIndex });
      await finishSession(s.id, 'submitted');
    }
    renderApp('/history');
    const list = await screen.findByTestId('history-list');
    expect(within(list).getAllByRole('link')).toHaveLength(3);
    expect(within(list).getAllByRole('link')[0]).toHaveTextContent('3 / 10');
    expect(screen.getByRole('img', { name: '회차별 정답률 추세 선 그래프' })).toBeInTheDocument();
    expect(screen.getByText(/3회 · 최고 30%/)).toBeInTheDocument();
  });
});
