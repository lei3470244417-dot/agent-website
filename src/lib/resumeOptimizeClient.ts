import type { ParsedResumeFile } from "./readResumeFile";

export type ResumeOptimizeResult = {
  message?: string;
  reply?: string;
  normalized?: {
    assistantReply?: string;
    resumeText?: string;
    evaluation?: unknown;
  };
};

const VISITOR_STORAGE_KEY = "career-hub-visitor-biz-id";

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(VISITOR_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(VISITOR_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function toErrorMessage(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && raw.trim()) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
  }
  return fallback;
}

/**
 * 将已解析的简历正文提交到服务端，经腾讯云 HTTP SSE 对话接口触发工作流。
 */
export async function uploadResumeForOptimization(
  parsed: ParsedResumeFile,
  workflow = "resume_optimize",
): Promise<ResumeOptimizeResult> {
  const resp = await fetch("/api/resume-optimize/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resumeText: parsed.text,
      visitorId: getOrCreateVisitorId(),
      workflow,
    }),
  });

  let payload: unknown = null;
  try {
    payload = await resp.json();
  } catch {
    payload = null;
  }

  if (!resp.ok) {
    throw new Error(toErrorMessage(payload, "请求失败，请稍后重试。"));
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("服务返回格式不正确。");
  }

  return payload as ResumeOptimizeResult;
}
