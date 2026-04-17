import { useRef, useState, type ChangeEvent } from "react";
import {
  MAX_ATTACHMENT_BYTES,
  readResumeFile,
  type ParsedResumeFile,
} from "../lib/readResumeFile";

type Props = {
  resume: string;
  onResumeChange: (v: string) => void;
  /** 用于「改前」对比；上传时会与当前稿一并更新 */
  resumeBaseline: string;
  onSetBaseline: () => void;
  /** 上传后由父组件更新正文、基准与可选的原始文件附件（给智能体解析） */
  onImportResume: (parsed: ParsedResumeFile) => void;
  hasFileAttachment?: boolean;
  onClearFileAttachment?: () => void;
};

const SAMPLE = `张伟 | 后端开发工程师
手机：138-0000-0000 | 邮箱：zhangwei@example.com

【工作经历】
2022.07 - 至今  某某科技有限公司  后端开发
- 负责订单与支付核心链路设计与迭代，接口 QPS 峰值 1.2 万。
- 推动容器化部署与灰度发布，平均发布时长从 40 分钟降至 12 分钟。

【项目】
统一风控引擎：基于规则引擎 + 实时特征，误判率下降 18%。

【技能】
Java、Spring Cloud、Redis、Kafka、Docker、Kubernetes

【教育】
2018 - 2022  某某大学  软件工程  本科`;

export function ResumeStudio({
  resume,
  onResumeChange,
  resumeBaseline,
  onSetBaseline,
  onImportResume,
  hasFileAttachment = false,
  onClearFileAttachment,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState("");

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFileError("");
    setFileBusy(true);
    try {
      const parsed = await readResumeFile(f);
      onImportResume(parsed);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err));
    } finally {
      setFileBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-surface px-4 py-3 shadow-glass sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">修改简历</h2>
          <p className="text-xs text-ink-400">
            左侧为上传的原始简历，右侧为当前修改稿；支持 .txt / .md / .docx / .pdf。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.markdown,.csv,.pdf,.docx,.doc,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            className="hidden"
            onChange={(ev) => void onFileChange(ev)}
          />
          <button
            type="button"
            disabled={fileBusy}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-glow transition hover:bg-accent/20 disabled:opacity-50"
          >
            {fileBusy ? "读取中…" : "上传简历"}
          </button>
          <button
            type="button"
            onClick={() => onResumeChange(SAMPLE)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-300 transition hover:border-accent/40 hover:text-white"
          >
            填入示例
          </button>
        </div>
      </div>

      {fileError ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {fileError}
        </p>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-surface shadow-glass md:grid-cols-2 md:divide-x md:divide-white/10">
        <div className="flex min-h-[360px] flex-col">
          <div className="shrink-0 border-b border-white/10 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-500">
            原始简历（改前基准）
          </div>
          <pre className="min-h-[280px] flex-1 overflow-auto whitespace-pre-wrap break-words bg-ink-950/40 px-4 py-3 font-mono text-xs leading-relaxed text-ink-300">
            {resumeBaseline.trim()
              ? resumeBaseline
              : "（尚无基准稿：可先上传文件，或在右侧编辑后点击下方「将当前稿设为改前基准」）"}
          </pre>
        </div>
        <div className="flex min-h-[360px] flex-col">
          <div className="shrink-0 border-b border-white/10 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-accent-glow/90">
            修改稿（当前编辑区）
          </div>
          <textarea
            value={resume}
            onChange={(e) => onResumeChange(e.target.value)}
            spellCheck={false}
            className="min-h-[280px] flex-1 resize-none bg-ink-950/40 px-4 py-3 font-mono text-xs leading-relaxed text-ink-100 placeholder:text-ink-500 focus:outline-none"
            placeholder="在此粘贴或编写修改后的简历；也可先上传 .docx / .pdf 自动填入。"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        <button
          type="button"
          onClick={onSetBaseline}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-300 transition hover:border-white/25 hover:text-white"
        >
          将当前稿设为改前基准
        </button>
        <button
          type="button"
          onClick={() => onResumeChange(resumeBaseline)}
          disabled={!resumeBaseline.trim()}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          用改前覆盖当前稿
        </button>
        {hasFileAttachment && onClearFileAttachment ? (
          <button
            type="button"
            onClick={onClearFileAttachment}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-500 transition hover:border-amber-500/40 hover:text-amber-200/90"
          >
            不再附带原始文件
          </button>
        ) : null}
        <span className="text-[11px] text-ink-500">
          ≤{Math.round(MAX_ATTACHMENT_BYTES / 1024)}KB 的文件会作为附件随对话请求一并发送给智能体。
        </span>
      </div>
    </div>
  );
}
