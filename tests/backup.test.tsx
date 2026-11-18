import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAll,
  createSession,
  exportAll,
  finishSession,
  getSession,
  getUsedSignatures,
  importAll,
  listSessions,
  updateResponse,
} from '../src/db/repo';
import { assembleTest } from '../src/generator/assemble';
import { renderApp } from './helpers';

beforeEach(async () => {
  await clearAll();
});

async function makeFinishedSession(seed: number) {
  const items = assembleTest({ seed, count: 10, levelRange: [1, 5] });
  const s = await createSession({ presetId: 'custom', mode: 'timed', items, minutes: 10 });
  await updateResponse(s.id, 0, { selected: items[0].answerIndex });
  await finishSession(s.id, 'submitted');
  return s.id;
}

describe('백업', () => {
  it('내보낸 뒤 모두 지우고 가져오면 기록·답·출제 이력이 그대로 돌아온다', async () => {
    const id = await makeFinishedSession(1);
    await makeFinishedSession(2);
    const before = await getSession(id);
    const used = await getUsedSignatures();

    // 파일로 저장했다가 읽는 것처럼 JSON 문자열을 거친다.
    const file = JSON.stringify(await exportAll());
    await clearAll();
    expect(await listSessions()).toHaveLength(0);

    const summary = await importAll(JSON.parse(file));
    expect(summary.sessions).toBe(2);
    expect(await getSession(id)).toEqual(before);
    expect(await getUsedSignatures()).toEqual(used);
  });

  it('가져오기는 지금 기록을 지우지 않고 더한다', async () => {
    await makeFinishedSession(1);
    const backup = await exportAll();
    await clearAll();
    await makeFinishedSession(3);
    await importAll(backup);
    expect(await listSessions()).toHaveLength(2);
  });

  it('다른 파일이나 손상된 백업은 거부하고 아무것도 바꾸지 않는다', async () => {
    await makeFinishedSession(1);
    await expect(importAll({ hello: 'world' })).rejects.toThrow('백업 파일이 아닙니다');
    const backup = await exportAll();
    await expect(importAll({ ...backup, version: 99 })).rejects.toThrow('더 새로운 버전');
    await expect(importAll({ ...backup, items: [] })).rejects.toThrow('손상');
    expect(await listSessions()).toHaveLength(1);
  });
});

describe('설정 화면', () => {
  it('백업 파일을 골라 기록을 가져오고, 전체 초기화는 확인 후 지운다', async () => {
    const user = userEvent.setup();
    await makeFinishedSession(1);
    const backup = JSON.stringify(await exportAll());
    await clearAll();

    renderApp('/settings');
    expect(await screen.findByText(/지금 저장된 기록: 0회/)).toBeInTheDocument();

    const file = new File([backup], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('import-input'), { target: { files: [file] } });
    expect(await screen.findByRole('status')).toHaveTextContent('기록 1회를 가져왔습니다');
    await waitFor(() => expect(screen.getByText(/지금 저장된 기록: 1회/)).toBeInTheDocument());

    // 잘못된 파일
    const bad = new File(['not json'], 'x.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('import-input'), { target: { files: [bad] } });
    expect(await screen.findByText(/파일을 읽을 수 없습니다/)).toBeInTheDocument();

    // 전체 초기화: 취소하면 그대로, 확인하면 지움
    await user.click(screen.getByRole('button', { name: '모든 기록 지우기' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '취소' }));
    expect(await listSessions()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '모든 기록 지우기' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '지우기' }));
    await waitFor(async () => expect(await listSessions()).toHaveLength(0));
  });
});
