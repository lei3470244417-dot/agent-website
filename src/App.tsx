import { useState } from "react";
import { AgentChat } from "./components/AgentChat";
import { CareerMatch } from "./components/CareerMatch";
import { MockInterview } from "./components/MockInterview";
import { ResumeStudio } from "./components/ResumeStudio";
import { ResumeAnalysis } from "./components/ResumeAnalysis";
import type { ResumeFileAttachment } from "./lib/agentClient";

type Tab = "resume" | "analysis" | "interview" | "match";

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: "resume", label: "修改简历", desc: "编辑正文 · 雷达画像" },
  { id: "analysis", label: "简历分析", desc: "核心评价 · 错误示例 · 能力雷达" },
  { id: "interview", label: "模拟面试", desc: "岗位问答 · 智能体扮演面试官" },
  { id: "match", label: "职业匹配", desc: "岗位契合度 · 投递建议" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("resume");
  const [resume, setResume] = useState("");
  /** 改前基准稿：上传时写入；也可点「将当前稿设为改前基准」更新 */
  const [resumeBaseline, setResumeBaseline] = useState("");
  /** 最近一次上传的原始文件（≤约 900KB 时随智能体请求 JSON 附带 base64） */
  const [resumeFileAttach, setResumeFileAttach] = useState<
    ResumeFileAttachment | undefined
  >();

  const modeLabel = TABS.find((t) => t.id === tab)?.label ?? "";

  return (
    <div className="min-h-screen bg-[#0f1118] text-ink-100">
      <div className="pointer-events-none fixed inset-0 bg-grid-fade" />
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-40" />

      <header className="relative border-b border-white/10 bg-ink-950/40 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <div className="animate-fade-up">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent-glow">
              Career Copilot
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              职引
            </h1>
            <p className="mt-2 max-w-2xl text-balance text-sm text-ink-400">
              简历润色、面试演练、岗位匹配一站完成；粘贴简历即可生成能力雷达，模拟面试页可与智能体自由对话。
            </p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          {/* 左侧垂直功能选择 */}
          <aside className="space-y-4">
            <nav className="rounded-2xl border border-white/10 bg-ink-950/60 p-3 shadow-glass">
              <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                功能
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`group flex flex-col rounded-xl border px-3 py-2 text-left transition ${
                      tab === t.id
                        ? "border-accent/60 bg-accent/15 shadow-[0_0_24px_-4px_rgba(99,102,241,0.5)]"
                        : "border-white/10 bg-surface hover:border-white/25"
                    }`}
                  >
                    <span className="text-xs font-semibold text-white">{t.label}</span>
                    <span className="mt-0.5 text-[11px] text-ink-500 group-hover:text-ink-400">
                      {t.desc}
                    </span>
                  </button>
                ))}
              </div>
            </nav>
          </aside>

          {/* 右侧主体内容 */}
          <div
            className={`grid gap-8 lg:items-start ${
              tab === "interview"
                ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,380px)]"
                : "lg:grid-cols-1"
            }`}
          >
            <div className="min-w-0 animate-fade-up">
            {tab === "resume" && (
              <ResumeStudio
                resume={resume}
                onResumeChange={setResume}
                resumeBaseline={resumeBaseline}
                onSetBaseline={() => setResumeBaseline(resume)}
                onImportResume={(parsed) => {
                  setResume(parsed.text);
                  setResumeBaseline(parsed.text);
                  setResumeFileAttach(parsed.attachment);
                }}
                hasFileAttachment={!!resumeFileAttach}
                onClearFileAttachment={() => setResumeFileAttach(undefined)}
              />
            )}
            {tab === "analysis" && (
              <ResumeAnalysis
                resume={resume}
                resumeBaseline={resumeBaseline}
                resumeFile={resumeFileAttach}
              />
            )}
            {tab === "interview" && (
              <MockInterview resume={resume} resumeFile={resumeFileAttach} />
            )}
            {tab === "match" && (
              <CareerMatch resume={resume} resumeFile={resumeFileAttach} />
            )}
            </div>
            {tab === "interview" && (
              <aside className="lg:sticky lg:top-8">
                <AgentChat
                  mode={modeLabel}
                  resumeSnippet={resume}
                  resumeFile={resumeFileAttach}
                />
              </aside>
            )}
          </div>
        </div>
      </main>

      <footer className="relative border-t border-white/10 py-8 text-center text-xs text-ink-500">
        本地演示 · 配置 VITE_AGENT_URL 后对接你的智能体服务
      </footer>
    </div>
  );
}
