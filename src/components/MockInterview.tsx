import { useState } from "react";
import { callAgent, type ChatMessage, type ResumeFileAttachment } from "../lib/agentClient";

type Props = { resume: string; resumeFile?: ResumeFileAttachment };

const STARTERS: { short: string; full: string }[] = [
  { short: "系统设计 + 追问", full: "请根据我的简历，出一道系统设计题并追问两轮。" },
  { short: "最有挑战的项目", full: "模拟行为面试：介绍你最有挑战的一个项目。" },
  { short: "STAR：团队冲突", full: "用 STAR 法则问我：团队冲突如何解决的案例。" },
];

export function MockInterview({ resume, resumeFile }: Props) {
  const [topic, setTopic] = useState("后端开发");
  const [log, setLog] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const runStarter = async (q: string) => {
    const sys: ChatMessage = {
      role: "system",
      content: `你是面试官，岗位方向：${topic}。结合候选人简历提问，简洁有深度。`,
    };
    const user: ChatMessage = { role: "user", content: q };
    setBusy(true);
    try {
      const reply = await callAgent([sys, user], {
        mode: "mock_interview",
        resumeSnippet: resume,
        resumeFile,
      });
      setLog((prev) => [...prev, user, { role: "assistant", content: reply }]);
    } catch (e) {
      setLog((prev) => [
        ...prev,
        user,
        {
          role: "assistant",
          content: `错误：${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-surface p-5 shadow-glass">
        <h2 className="font-display text-lg font-semibold text-white">模拟面试</h2>
        <p className="mt-1 text-sm text-ink-400">
          选择方向后点下方快捷提问，或在右侧智能体对话框里自由追问
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-ink-400">
            岗位方向
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="ml-2 w-40 rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-sm text-white focus:border-accent/40 focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => setLog([])}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-300 hover:text-white"
          >
            清空对话
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s.short}
              type="button"
              disabled={busy}
              onClick={() => void runStarter(s.full)}
              className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent-glow transition hover:bg-accent/20"
            >
              {s.short}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-[200px] space-y-3 rounded-2xl border border-white/10 bg-ink-950/30 p-4">
        {log.length === 0 && (
          <p className="text-sm text-ink-500">尚无记录，点击上方快捷按钮开始。</p>
        )}
        {log.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl border px-3 py-2 text-sm ${
              m.role === "user"
                ? "border-accent/20 bg-accent/10 text-ink-100"
                : "border-white/10 bg-surface text-ink-200"
            }`}
          >
            <span className="text-[10px] text-ink-500">
              {m.role === "user" ? "你" : "面试官"}
            </span>
            <pre className="mt-1 whitespace-pre-wrap font-sans">{m.content}</pre>
          </div>
        ))}
        {busy && <p className="text-xs text-accent-glow animate-pulse">生成中…</p>}
      </div>
    </div>
  );
}
