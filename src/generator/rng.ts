// 시드 기반 난수. 같은 시드를 넣으면 항상 같은 순서의 수가 나온다.
// 생성기 안에서는 Math.random() 대신 반드시 이 파일의 함수만 쓴다.

export type Rng = () => number;

/** mulberry32: 32비트 시드로 0 이상 1 미만의 수를 만든다. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드와 보조 값을 섞어 새 시드를 만든다 (재시도·문항 번호별 시드 파생용). */
export function mixSeed(seed: number, salt: number): number {
  let h = (seed >>> 0) ^ Math.imul((salt + 0x9e3779b9) >>> 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 0 이상 n 미만의 정수 */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('빈 배열에서는 고를 수 없습니다.');
  return arr[randInt(rng, arr.length)];
}

/** 원본을 바꾸지 않고 섞은 새 배열을 돌려준다 (피셔-예이츠). */
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 서로 다른 k개를 고른다. */
export function sample<T>(rng: Rng, arr: readonly T[], k: number): T[] {
  return shuffle(rng, arr).slice(0, k);
}

/** [값, 가중치] 목록에서 가중치에 비례해 하나를 고른다. */
export function weighted<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let x = rng() * total;
  for (const [value, w] of entries) {
    x -= w;
    if (x < 0) return value;
  }
  return entries[entries.length - 1][0];
}
