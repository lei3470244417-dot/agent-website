import cloudbase from '@cloudbase/js-sdk';
import type { ResumeFileAttachment } from "./readResumeFile";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
export type { ResumeFileAttachment };

// 初始化云开发 SDK（使用你的环境 ID）
const app = cloudbase.init({
  env: 'cv-base-7gzpvzza6d3b781f'
});

/** 供腾讯云 LKE 等多轮会话使用；同浏览器标签内保持不变 */
function getLkeSessionId(): string | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  const k = "career_hub_lke_session";
  let v = sessionStorage.getItem(k);
  if (!v) {
    v = crypto.randomUUID();
    sessionStorage.setItem(k, v);
  }
  return v;
}

export async function callAgent(
  messages: ChatMessage[],
  context: { resumeSnippet?: string; mode?: string; resumeFile?: ResumeFileAttachment }
): Promise<string> {
  const lkeSessionId = getLkeSessionId();
  const fileCtx = context.resumeFile
    ? {
        resume_file_name: context.resumeFile.filename,
        resume_file_mime: context.resumeFile.mime_type,
        resume_file_base64: context.resumeFile.base64,
      }
    : {};

  try {
    // 通过 SDK 调用云函数 agentProxy
    const result = await app.callFunction({
      name: 'agentProxy',
      data: {
        messages,
        context: {
          resume_excerpt: context.resumeSnippet?.slice(0, 8000),
          mode: context.mode,
          ...fileCtx,
          ...(lkeSessionId ? { lke_session_id: lkeSessionId } : {}),
        },
      },
    });

    // 云函数返回格式为 { reply: string }
    const reply = result.result?.reply;
    if (reply) {
      return reply;
    } else {
      throw new Error('云函数未返回有效回复');
    }
  } catch (error) {
    console.error('调用云函数失败:', error);
    return '抱歉，服务暂时不可用，请稍后再试。';
  }
}
