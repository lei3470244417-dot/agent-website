import { useMemo, useState } from "react";
import { buildProfileFromResume } from "../lib/profileRadar";
import { callAgent, type ResumeFileAttachment } from "../lib/agentClient";
import {
  parseJobRecommendationsFromReply,
  type RecommendedJob,
} from "../lib/parseJobRecommendations";

type Props = { resume: string; resumeFile?: ResumeFileAttachment };

const JOB_JSON_INSTRUCTION = `只输出一个 JSON 对象，不要 markdown、不要解释文字。格式严格如下（恰好 3 条 positions）：
{"positions":[{"title":"岗位名称","companyContext":"行业/公司类型或典型雇主","whyFit":"结合简历一句话说明为何适合"},{"title":"...","companyContext":"...","whyFit":"..."},{"title":"...","companyContext":"...","whyFit":"..."}]}`;

export function CareerMatch({ resume, resumeFile }: Props) {
  const [role, setRole] = useState("高级后端工程师");
  const [industry, setIndustry] = useState("互联网 / 企业服务");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<RecommendedJob[]>([]);
  const [jobsRaw, setJobsRaw] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const radar = useMemo(() => buildProfileFromResume(resume), [resume]);
  const quickScore = useMemo(() => {
    const avg = radar.reduce((s, d) => s + d.score, 0) / radar.length;
    return Math.round(avg * 0.72 + (resume.length > 200 ? 18 : 8));
  }, [radar, resume.length]);

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const prompt = `你是职业顾问。候选人目标岗位：${role}；行业：${industry}。
请根据简历摘要做匹配分析，输出：1）匹配度简述 2）三条优势 3）三条缺口与提升建议 4）是否建议投递（是/谨慎/不建议）及理由。
简历摘要：\n${resume.slice(0, 3500)}`;
      const reply = await callAgent(
        [
          { role: "system", content: "回答使用中文，条理清晰。" },
          { role: "user", content: prompt },
        ],
        { mode: "career_match", resumeSnippet: resume, resumeFile }
      );
      setResult(reply);
    } catch (e) {
      setResult(`请求失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendedJobs = async () => {
    setJobsLoading(true);
    setJobsError(null);
    setJobs([]);
    setJobsRaw(null);
    try {
      const userContent = `${JOB_JSON_INSTRUCTION}\n\n候选人简历摘要：\n${resume.slice(0, 4000)}`;
      const raw = await callAgent(
        [
          { role: "system", content: "你是资深招聘顾问，输出合法 JSON，键名与示例完全一致。" },
          { role: "user", content: userContent },
        ],
        { mode: "career_jobs", resumeSnippet: resume, resumeFile }
      );
      setJobsRaw(raw);
      const parsed = parseJobRecommendationsFromReply(raw);
      if (!parsed || parsed.length === 0) {
        setJobsError("未能从回复中解析出岗位 JSON，请检查智能体是否按约定格式返回。");
      } else {
        setJobs(parsed.slice(0, 3));
      }
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : String(e));
    } finally {
      setJobsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-surface p-5 shadow-glass">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">智能体推荐岗位</h2>
            <p className="mt-1 text-sm text-ink-400">
              根据当前简历正文（及已上传文件，若后端支持）生成三个可投递方向，便于快速对齐市场岗位。
            </p>
          </div>
          <button
            type="button"
            disabled={jobsLoading || !resume.trim()}
            onClick={() => void loadRecommendedJobs()}
            className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lift disabled:opacity-40"
          >
            {jobsLoading ? "生成中…" : "生成三个推荐岗位"}
          </button>
        </div>
        {jobsError && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {jobsError}
          </p>
        )}
        {jobs.length > 0 && (
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {jobs.map((j, idx) => (
              <li
                key={`${j.title}-${idx}`}
                className="flex flex-col rounded-xl border border-white/10 bg-ink-950/40 p-4"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-accent-glow">
                  推荐 {idx + 1}
                </span>
                <h3 className="mt-1 font-display text-base font-semibold text-white">{j.title}</h3>
                {j.companyOrIndustry && (
                  <p className="mt-2 text-xs text-ink-400">{j.companyOrIndustry}</p>
                )}
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-200">{j.whyFit || "—"}</p>
              </li>
            ))}
          </ul>
        )}
        {!jobsLoading && jobs.length === 0 && !jobsError && (
          <p className="mt-4 text-sm text-ink-500">点击按钮向智能体请求结构化推荐；需配置 VITE_AGENT_URL。</p>
        )}
        {jobsRaw && jobs.length === 0 && jobsError && (
          <details className="mt-4 text-xs text-ink-500">
            <summary className="cursor-pointer text-ink-400">查看原始回复（排错）</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-ink-950/60 p-2 font-sans text-ink-400">
              {jobsRaw}
            </pre>
          </details>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 rounded-2xl border border-white/10 bg-surface p-5 shadow-glass lg:col-span-2">
        <h2 className="font-display text-lg font-semibold text-white">职业匹配</h2>
        <label className="block text-sm text-ink-400">
          目标岗位
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-white focus:border-accent/40 focus:outline-none"
          />
        </label>
        <label className="block text-sm text-ink-400">
          行业 / 公司类型
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-white focus:border-accent/40 focus:outline-none"
          />
        </label>
        <div className="rounded-xl border border-white/10 bg-ink-950/40 p-4">
          <p className="text-xs text-ink-500">快速参考（启发式，非模型结论）</p>
          <p className="mt-2 font-display text-3xl font-bold text-white">{quickScore}%</p>
          <p className="text-xs text-ink-400">综合简历长度与雷达均分估算</p>
        </div>
        <button
          type="button"
          disabled={loading || !resume.trim()}
          onClick={() => void analyze()}
          className="w-full rounded-xl bg-gradient-to-r from-accent to-cyan-500 py-2.5 text-sm font-semibold text-white shadow-lift disabled:opacity-40"
        >
          {loading ? "分析中…" : "让智能体深度匹配分析"}
        </button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-ink-950/30 p-5 lg:col-span-3">
        <h3 className="text-sm font-medium text-ink-300">分析报告</h3>
        {!result && !loading && (
          <p className="mt-4 text-sm text-ink-500">
            填写左侧信息并点击按钮；未配置 API 时将看到演示说明。
          </p>
        )}
        {loading && <p className="mt-4 text-sm text-accent-glow animate-pulse">正在请求智能体…</p>}
        {result && (
          <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-200">
            {result}
          </pre>
        )}
      </div>
    </div>
    </div>
  );
}
