export type ResumeOptimizeResult = {
  message?: string;
  docBizId?: string;
  workflowResult?: unknown;
  normalized?: {
    assistantReply?: string;
    resumeText?: string;
    evaluation?: unknown;
  };
};

function toErrorMessage(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && raw.trim()) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
  }
  return fallback;
}

export async function uploadResumeForOptimization(
  file: File,
  workflow = "resume_optimize"
): Promise<ResumeOptimizeResult> {
  const resp = await fetch("/api/resume-optimize/upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name || "resume.pdf"),
      "X-Workflow": workflow,
    },
    body: file,
  });

  let payload: unknown = null;
  try {
    payload = await resp.json();
  } catch {
    payload = null;
  }

  if (!resp.ok) {
    throw new Error(toErrorMessage(payload, "上传失败，请稍后重试。"));
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("服务返回格式不正确。");
  }

  return payload as ResumeOptimizeResult;
}
