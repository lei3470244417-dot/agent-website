import tencentcloud from "tencentcloud-sdk-nodejs-lke";
import COS from "cos-nodejs-sdk-v5";
import { randomUUID } from "crypto";

const LkeClient = tencentcloud.lke.v20231130.Client;

function getAllowedOrigin() {
  return process.env.CORS_ALLOW_ORIGIN || "https://agent-website-seven.vercel.app";
}

function sanitizeFileName(name = "resume.pdf") {
  return name.replace(/[^\w.\-() ]/g, "_").slice(0, 120);
}

function detectFileType(filename, contentType = "") {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || contentType === "application/pdf") return "pdf";
  if (
    lower.endsWith(".docx") ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (lower.endsWith(".doc") || contentType === "application/msword") return "doc";
  if (lower.endsWith(".txt") || contentType.startsWith("text/")) return "txt";
  return "pdf";
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function firstString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = firstString(item);
      if (hit) return hit;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  const preferredKeys = [
    "Reply",
    "reply",
    "Answer",
    "answer",
    "Content",
    "content",
    "Message",
    "message",
    "Text",
    "text",
  ];
  for (const k of preferredKeys) {
    if (k in value) {
      const hit = firstString(value[k]);
      if (hit) return hit;
    }
  }
  for (const v of Object.values(value)) {
    const hit = firstString(v);
    if (hit) return hit;
  }
  return "";
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

function normalizeWorkflowResult(workflowResponse) {
  const customVariables =
    workflowResponse?.CustomVariables ||
    workflowResponse?.customVariables ||
    workflowResponse?.Variables ||
    null;
  const assistantReply = firstString(workflowResponse);
  const parsedFromText = parseStructuredFromText(assistantReply);
  const resumeText =
    customVariables?.resume_text ||
    customVariables?.resumeText ||
    workflowResponse?.ResumeText ||
    parsedFromText.resumeText ||
    "";
  const evaluation =
    customVariables?.evaluation ||
    customVariables?.score_card ||
    workflowResponse?.Evaluation ||
    parsedFromText.evaluation ||
    null;
  return { assistantReply, resumeText, evaluation };
}

async function getStorageCredential(client, botBizId, fileType, typeKey = "realtime") {
  const params = {
    BotBizId: botBizId,
    FileType: fileType,
    IsPublic: false,
    TypeKey: typeKey,
  };
  return client.DescribeStorageCredential(params);
}

async function uploadToCos(credential, fileBuffer) {
  const { Bucket, Region, UploadPath, Credentials } = credential;
  const cos = new COS({
    SecretId: Credentials.TmpSecretId,
    SecretKey: Credentials.TmpSecretKey,
    SecurityToken: Credentials.Token,
  });
  await cos.putObject({
    Bucket,
    Region,
    Key: UploadPath,
    Body: fileBuffer,
  });
  return { uploadPath: UploadPath, bucket: Bucket, region: Region };
}

async function saveDoc(client, botBizId, fileName, fileType, uploadPath, fileSize, bucket, region) {
  const params = {
    BotBizId: botBizId,
    FileName: fileName,
    FileType: fileType,
    CosUrl: uploadPath,
    Size: String(fileSize),
    Bucket: bucket,
    Region: region,
  };
  const response = await client.SaveDoc(params);
  return response.DocBizId;
}

async function triggerWorkflow(client, botAppKey, fileInfos, customVariables = {}) {
  const params = {
    BotAppKey: botAppKey,
    VisitorBizId: `visitor_${randomUUID()}`,
    SessionId: randomUUID(),
    RequestId: randomUUID(),
    Content: "请根据我上传的简历，生成优化后的版本，并输出简历评价。",
    FileInfos: fileInfos,
    CustomVariables: customVariables,
    StreamingThrottle: 5,
  };
  return client.StartAIConversation(params);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin());
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-File-Name, X-Workflow");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const fileBuffer = await readRawBody(req);
    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: "未收到文件内容" });
    }

    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const botBizId = process.env.TENCENT_BOT_BIZ_ID;
    const botAppKey = process.env.TENCENT_BOT_APP_KEY;
    const tencentRegion = process.env.TENCENT_REGION || "ap-guangzhou";

    if (!secretId || !secretKey || !botBizId || !botAppKey) {
      return res.status(500).json({ error: "服务器环境变量未配置完整" });
    }

    const rawName = req.headers["x-file-name"] || "resume.pdf";
    const decodedName =
      typeof rawName === "string" ? decodeURIComponent(rawName) : "resume.pdf";
    const fileName = sanitizeFileName(decodedName);
    const contentType =
      typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "";
    const fileType = detectFileType(fileName, contentType);
    const workflow = req.headers["x-workflow"] || "resume_optimize";

    const client = new LkeClient({
      credential: { secretId, secretKey },
      region: tencentRegion,
      profile: { httpProfile: { endpoint: "lke.tencentcloudapi.com" } },
    });

    const credential = await getStorageCredential(client, botBizId, fileType, "realtime");
    const uploadResult = await uploadToCos(credential, fileBuffer);
    const docBizId = await saveDoc(
      client,
      botBizId,
      fileName,
      fileType,
      uploadResult.uploadPath,
      fileBuffer.length,
      uploadResult.bucket,
      uploadResult.region
    );

    const fileInfos = [
      {
        DocBizId: docBizId,
        FileName: fileName,
        FileType: fileType,
        CosUrl: uploadResult.uploadPath,
      },
    ];

    const workflowResponse = await triggerWorkflow(client, botAppKey, fileInfos, {
      workflow,
    });
    const normalized = normalizeWorkflowResult(workflowResponse);

    return res.status(200).json({
      message: "文件上传成功，工作流已触发",
      docBizId,
      workflowResult: workflowResponse,
      normalized,
    });
  } catch (error) {
    console.error("处理请求时发生错误:", error);
    return res.status(500).json({ error: error?.message || "服务器内部错误" });
  }
}
