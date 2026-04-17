import { useMemo, useState } from "react";
import { buildProfileFromResume, profileSummary } from "../lib/profileRadar";
import { RadarProfile } from "./RadarProfile";
import { callAgent, type ResumeFileAttachment } from "../lib/agentClient";

type Props = {
  resume: string;
  resumeBaseline: string;
  resumeFile?: ResumeFileAttachment;
};

export function ResumeAnalysis({ resume, resumeBaseline, resumeFile }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const radar = useMemo(() => buildProfileFromResume(resume || resumeBaseline), [
    resume,
    resumeBaseline,
  ]);
  const summary = useMemo(() => profileSummary(radar), [radar]);

  const hasText = (resume || resumeBaseline).trim().length > 0;

  const runAnalysis = async () => {
    if (!hasText || loading) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const current = resume.trim() || resumeBaseline.trim();
      const prompt = `你是资深简历顾问，请对下面的简历做结构化分析，要求：\n\n1）先给出 3-5 句话的「核心评价」（整体定位、优缺点、适合的岗位层级）。\n2）挑出 5-8 个代表性的「存在问题的句子或片段」，逐条给出：原句、问题说明、修改建议（给出改写示例）。\n3）可以再给 3 条「整体优化建议」（例如结构、篇幅、项目呈现方式）。\n\n请用 Markdown 分点输出，中文回答，不要输出 JSON。\n\n简历正文：\n${current.slice(
        0,
        6000,
      )}\n\n如有必要，可结合你对市场岗位的通用理解，但不要编造经历。`;

      const reply = await callAgent(
        [
          { role: "system", content: "你是严格但友好的简历顾问，回答使用中文，结构清晰。" },
          { role: "user", content: prompt },
        ],
        { mode: "resume_analysis", resumeSnippet: current, resumeFile },
      );
      setAnalysis(reply);
    } catch (e) {
      setAnalysis(`请求失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <section className="space-y-4 rounded-2xl border border-white/10 bg-surface p-5 shadow-glass">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">简历分析</h2>
            <p className="mt-1 text-sm text-ink-400">
              生成核心评价，并挑出有代表性的表述问题，给出修改示例。
            </p>
          </div>
          <button
            type="button"
            disabled={!hasText || loading}
            onClick={() => void runAnalysis()}
            className="shrink-0 rounded-xl bg-gradient-to-r from-accent to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lift disabled:opacity-40"
          >
            {loading ? "分析中…" : "生成简历分析"}
          </button>
        </header>
        {!hasText && (
          <p className="text-sm text-ink-500">
            请先在「修改简历」中上传或粘贴简历内容，再回到此处生成分析。
          </p>
        )}
        {hasText && !analysis && !loading && (
          <p className="text-sm text-ink-500">
            点击右上按钮调用智能体分析；未配置 API 时会展示占位回复。
          </p>
        )}
        {loading && (
          <p className="text-sm text-accent-glow animate-pulse">正在请求智能体分析你的简历…</p>
        )}
        {analysis && (
          <article className="prose prose-invert prose-sm max-w-none">
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-200">
              {analysis}
            </div>
          </article>
        )}
      </section>

      <section className="space-y-4">
        <RadarProfile data={radar} />
        <div className="rounded-2xl border border-white/10 bg-ink-950/40 p-4 text-sm text-ink-300">
          <p className="text-balance text-ink-200">{summary}</p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-ink-500">
            <li>雷达图基于简历关键词的本地启发式分析，可替换为你后端返回的打分 JSON。</li>
            <li>
              当前「简历分析」会优先使用修改稿；若修改稿为空，则使用上传时的原始简历文本。
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

