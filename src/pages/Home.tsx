export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-16 pb-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">추리력 테스트</h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          시험을 볼 때마다 새로 만들어지는 도형 행렬 문제로 추리력을 연습합니다.
        </p>
      </header>

      <section className="mt-10">
        <button
          type="button"
          disabled
          className="h-14 w-full rounded-xl bg-neutral-900 text-lg font-semibold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          시험 시작
        </button>
        <p className="mt-3 text-center text-sm text-neutral-500">
          아직 준비 중입니다. 문제 생성기를 만든 뒤 열립니다.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-500">최근 기록</h2>
        <p className="mt-3 rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          아직 본 시험이 없습니다.
        </p>
      </section>

      <footer className="mt-auto pt-10 text-center text-xs leading-relaxed text-neutral-400 dark:text-neutral-600">
        이 앱의 점수는 공인 IQ가 아니며 본인 기록 간 비교용입니다.
      </footer>
    </main>
  );
}
