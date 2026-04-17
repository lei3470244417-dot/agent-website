type Props = {
  before: string;
  after: string;
};

function stats(a: string, b: string) {
  const same = a === b;
  return {
    same,
    beforeLines: a ? a.split("\n").length : 0,
    afterLines: b ? b.split("\n").length : 0,
    beforeChars: a.length,
    afterChars: b.length,
  };
}

export function ResumeCompare({ before, after }: Props) {
  const s = stats(before, after);

  if (!before.trim() && !after.trim()) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-ink-950/30 p-6 text-center text-sm text-ink-500">
        上传简历或点击「将当前稿设为改前」后，此处会显示<strong className="text-ink-400"> 改前 / 改后 </strong>
        并排对比。编辑左侧正文即更新「改后」。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface shadow-glass">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-white">简历前后对比</h3>
        <p className="text-xs text-ink-500">
          {s.same ? (
            <span className="text-ink-400">改前与改后一致</span>
          ) : (
            <>
              改前 <span className="text-ink-300">{s.beforeChars}</span> 字 /{" "}
              <span className="text-ink-300">{s.beforeLines}</span> 行 → 改后{" "}
              <span className="text-accent-glow">{s.afterChars}</span> 字 /{" "}
              <span className="text-accent-glow">{s.afterLines}</span> 行
            </>
          )}
        </p>
      </div>
      <div className="grid max-h-[min(420px,50vh)] grid-cols-1 gap-0 md:grid-cols-2 md:divide-x md:divide-white/10">
        <div className="flex min-h-0 flex-col">
          <div className="shrink-0 border-b border-white/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-500">
            改前（基准稿）
          </div>
          <pre className="min-h-[200px] flex-1 overflow-auto whitespace-pre-wrap break-words bg-ink-950/40 px-3 py-2 font-mono text-xs leading-relaxed text-ink-300">
            {before.trim() ? before : "（尚无基准稿）"}
          </pre>
        </div>
        <div className="flex min-h-0 flex-col border-t border-white/10 md:border-t-0">
          <div className="shrink-0 border-b border-white/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-accent-glow/90">
            改后（当前编辑区）
          </div>
          <pre className="min-h-[200px] flex-1 overflow-auto whitespace-pre-wrap break-words bg-ink-950/40 px-3 py-2 font-mono text-xs leading-relaxed text-ink-100">
            {after.trim() ? after : "（空）"}
          </pre>
        </div>
      </div>
    </div>
  );
}
