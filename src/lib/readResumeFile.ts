import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_BYTES = 2 * 1024 * 1024;
/** 超过此大小仅做浏览器内抽字，不把 base64 塞进 JSON（避免撑爆请求） */
export const MAX_ATTACHMENT_BYTES = 900 * 1024;

const TEXT_EXT = /\.(txt|md|markdown|csv|log|json)$/i;

/** 随对话 POST 传给后端，供智能体侧文件解析工具使用 */
export type ResumeFileAttachment = {
  filename: string;
  mime_type: string;
  base64: string;
};

export type ParsedResumeFile = {
  text: string;
  /** 供具备文件解析能力的智能体使用；大文件会自动省略 */
  attachment?: ResumeFileAttachment;
};

function isProbablyText(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json") return true;
  return TEXT_EXT.test(file.name);
}

function detectKind(file: File): "docx" | "pdf" | "text" | "msword" | "unknown" {
  const n = file.name.toLowerCase();
  if (n.endsWith(".docx") || file.type.includes("wordprocessingml")) return "docx";
  if (n.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (file.type === "application/msword" || n.endsWith(".doc")) return "msword";
  if (isProbablyText(file)) return "text";
  return "unknown";
}

function guessMime(kind: "docx" | "pdf" | "text", file: File): string {
  if (file.type) return file.type;
  if (kind === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (kind === "pdf") return "application/pdf";
  return "text/plain";
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(new Error("读取文件失败。"));
    r.readAsArrayBuffer(file);
  });
}

function readTextFromBuffer(buf: ArrayBuffer): string {
  const t = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  return t.replace(/\r\n/g, "\n").trim();
}

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(buf.slice(0));
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const line = tc.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    parts.push(line);
  }
  return parts.join("\n\n").replace(/\s+\n/g, "\n").trim();
}

/**
 * 读取简历：支持 .txt / .md、.docx（mammoth）、.pdf（pdf.js 文本层）。
 * 文件 ≤ MAX_ATTACHMENT_BYTES 时附带 base64，便于你的后端/智能体再用工具解析（如 OCR、结构化）。
 */
export async function readResumeFile(file: File): Promise<ParsedResumeFile> {
  if (file.size > MAX_BYTES) {
    throw new Error(`文件过大（>${MAX_BYTES / 1024 / 1024}MB），请压缩或分段。`);
  }

  const buf = await fileToArrayBuffer(file);
  const kind = detectKind(file);

  if (kind === "msword") {
    throw new Error("不支持旧版 .doc，请在 Word 中「另存为」.docx 或 PDF 后再上传。");
  }
  if (kind === "unknown") {
    throw new Error("无法识别格式，请使用 .txt、.md、.docx 或 .pdf。");
  }

  const attachment: ResumeFileAttachment | undefined =
    file.size <= MAX_ATTACHMENT_BYTES
      ? {
          filename: file.name || "resume",
          mime_type: guessMime(kind, file),
          base64: bufferToBase64(buf),
        }
      : undefined;

  let text: string;
  if (kind === "docx") {
    const r = await mammoth.extractRawText({ arrayBuffer: buf });
    text = (r.value || "").trim();
    const warn = r.messages?.find((m) => m.type === "error");
    if (warn && !text) {
      throw new Error("无法从 Word 文档提取文字，文件可能已损坏。");
    }
  } else if (kind === "pdf") {
    text = await extractPdfText(buf);
  } else {
    text = readTextFromBuffer(buf);
  }

  if (!text) {
    if (attachment) {
      text =
        "（浏览器未能从该 PDF/文档中提取到可见文字，可能是扫描件。已将原始文件随请求附带，请让智能体用解析/OCR 工具处理。）";
    } else {
      throw new Error(
        `未能提取文字，且文件超过 ${Math.round(MAX_ATTACHMENT_BYTES / 1024)}KB，无法随请求附带原文件。请改用较小的 PDF、或导出为 .docx/.txt。`
      );
    }
  }

  return { text, attachment };
}
