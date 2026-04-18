import crypto from "crypto";

const SSE_URL = "https://wss.lke.cloud.tencent.com/v1/qbot/chat/sse";

function getAllowedOrigin() {
  return process.env.CORS_ALLOW_ORIGIN || "*";
}

function parseStructuredFromText(text) {
  if (!text) return { resumeText: "", evaluation: null };
  const trimmed = text.trim();
  try {
    const obj = JSON.parse(trimmed);
    return {
      resumeText: obj.resume_text || obj.resumeText || "",
      evaluation: obj.evaluation || obj.score_card || null,
    };
  } catch {
    return { resumeText: "", evaluation: null };
  }
}

function normalizeAssistantReply(fullText) {
  const assistantReply = (fullText || "").trim();
  const parsedFromText = parseStructuredFromText(assistantReply);
  const resumeText = parsedFromText.resumeText || "";
  const evaluation = parsedFromText.evaluation;
  return { assistantReply, resumeText, evaluation };
}

function appendStreamChunk(full, chunk) {
  if (!chunk) return full;
  if (full && chunk.startsWith(full)) return chunk;
  return full + chunk;
}

function extractDeltaFromSseJson(parsed) {
  if (!parsed) return "";
  if (Array.isArray(parsed)) {
    const eventName = parsed[0];
    const body = parsed[1];
    if (eventName === "error") {
      const msg =
        body?.payload?.message ||
        body?.payload?.error_msg ||
        body?.message ||
        "智能体返回错误";
      throw new Error(String(msg));
    }
    if (eventName === "reply" && body?.payload?.content != null) {
      return String(body.payload.content);
    }
  }
  if (parsed.type === "error") {
    const msg =
      parsed.payload?.message || parsed.payload?.error_msg || parsed.message || "智能体返回错误";
    throw new Error(String(msg));
  }
  if (parsed.type === "reply" && parsed.payload?.content != null) {
    return String(parsed.payload.content);
  }
  if (parsed.payload?.content != null) {
    return String(parsed.payload.content);
  }
  return "";
}

function buildContent({ query, resumeText, workflow }) {
  const instruction =
    (typeof query === "string" && query.trim()) ||
    "请根据以下简历正文，生成优化后的版本，并输出简历评价。若使用 JSON 输出，请包含 resume_text 与 evaluation 字段。";
  const wfLine =
    workflow && String(workflow).trim()
      ? `\n（工作流标识：${String(workflow).trim()}；单工作流应用可忽略本行。）`
      : "";
  const text = typeof resumeText === "string" ? resumeText.trim() : "";
  if (!text) {
    throw new Error("缺少简历正文：请在前端解析文件后再调用本接口。");
  }
  const combined = `${instruction}${wfLine}\n\n---简历正文---\n\n${text}`;
  return combined.slice(0, 120000);
}

function decodeSseLines(buffer, onDataPayload) {
  const parts = buffer.split(/\r?\n/);
  const tail = parts.pop() ?? "";
  for (const line of parts) {
    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (payload) onDataPayload(payload);
    }
  }
  return tail;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin());
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const { query, visitorId, workflow } = body;
    const resumeText = body.resumeText;

    const botAppKey = process.env.TENCENT_BOT_APP_KEY;
    if (!botAppKey) {
      return res.status(500).json({ error: "服务器配置错误：缺少 TENCENT_BOT_APP_KEY" });
    }

    const requestId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const finalVisitorId = (typeof visitorId === "string" && visitorId.trim()) || crypto.randomUUID();

    const content = buildContent({ query, resumeText, workflow });

    const customVars =
      workflow && String(workflow).trim() ? { workflow: String(workflow).trim() } : {};

    const requestBody = {
      bot_app_key: botAppKey,
      visitor_biz_id: finalVisitorId,
      session_id: sessionId,
      request_id: requestId,
      content,
      streaming_throttle: 5,
      incremental: true,
      stream: "enable",
      ...(Object.keys(customVars).length ? { custom_variables: customVars } : {}),
    };

    const response = await fetch(SSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`腾讯云 API 返回错误: ${response.status}${errText ? ` ${errText.slice(0, 200)}` : ""}`);
    }

    if (!response.body?.getReader) {
      throw new Error("响应不支持流式读取");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let lineBuf = "";

    while (true) {
      const { done, value } = await reader.read();
      lineBuf += decoder.decode(value, { stream: !done });
      lineBuf = decodeSseLines(lineBuf, (payload) => {
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);
          const delta = extractDeltaFromSseJson(parsed);
          if (delta) fullResponse = appendStreamChunk(fullResponse, delta);
        } catch (e) {
          if (!(e instanceof SyntaxError)) throw e;
        }
      });
      if (done) break;
    }

    if (lineBuf.trim()) {
      decodeSseLines(`${lineBuf}\n`, (payload) => {
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);
          const delta = extractDeltaFromSseJson(parsed);
          if (delta) fullResponse = appendStreamChunk(fullResponse, delta);
        } catch (e) {
          if (!(e instanceof SyntaxError)) throw e;
        }
      });
    }

    const trimmed = fullResponse.trim();
    const normalized = normalizeAssistantReply(trimmed);

    return res.status(200).json({
      message: "智能体流式回复已完成",
      reply: trimmed || "智能体未返回有效内容",
      normalized,
    });
  } catch (error) {
    console.error("处理请求时发生错误:", error);
    return res.status(500).json({ error: error?.message || "服务器内部错误" });
  }
}
