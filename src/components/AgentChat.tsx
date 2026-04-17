import { useCallback, useRef, useState } from "react";
import { callAgent, type ChatMessage, type ResumeFileAttachment } from "../lib/agentClient";

type Props = {
  mode: string;
  resumeSnippet: string;
  resumeFile?: ResumeFileAttachment;
};

export function AgentChat({ mode, resumeSnippet, resumeFile }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "你好，我是模拟面试助手。结合你的简历扮演面试官；可自由追问、要评分标准或换一题。若简历在「修改简历」里已粘贴/上传，我会一并参考。",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await callAgent(next, {
        mode,
        resumeSnippet: resumeSnippet.slice(0, 8000),
        resumeFile,
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `请求失败：${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(scrollDown, 80);
    }
  };

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-2xl border border-white/10 bg-surface shadow-glass">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-white">智能体</h3>
        <p className="text-xs text-ink-400">对接你的 API · 见 .env 说明</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm leading-relaxed">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[95%] rounded-xl px-3 py-2 ${
              m.role === "user"
                ? "ml-auto bg-accent/25 text-ink-100"
                : "mr-auto border border-white/10 bg-ink-950/50 text-ink-200"
            }`}
          >
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-500">
              {m.role === "user" ? "你" : "助手"}
            </span>
            <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-accent-glow animate-pulse">正在思考…</div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="输入消息… Enter 发送，Shift+Enter 换行"
            className="min-h-[52px] flex-1 resize-none rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading}
            className="self-end rounded-xl bg-gradient-to-br from-accent to-accent-dim px-4 py-2 text-sm font-semibold text-white shadow-lift transition hover:opacity-95 disabled:opacity-40"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
