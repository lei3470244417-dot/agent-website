/** 从智能体回复中解析「恰好三个岗位」的 JSON（兼容外层 markdown 代码块） */

export type RecommendedJob = {
  title: string;
  companyOrIndustry: string;
  whyFit: string;
};

type RawPosition = {
  title?: string;
  companyContext?: string;
  company_or_industry?: string;
  whyFit?: string;
  why_fit?: string;
  matchReason?: string;
};

type RawPayload = {
  positions?: RawPosition[];
  jobs?: RawPosition[];
};

function stripCodeFences(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  const withoutOpen = t.replace(/^```(?:json)?\s*\n?/i, "");
  const end = withoutOpen.lastIndexOf("```");
  if (end !== -1) return withoutOpen.slice(0, end).trim();
  return withoutOpen.trim();
}

function extractJsonSlice(text: string): string {
  const body = stripCodeFences(text);
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("未找到 JSON 对象");
  return body.slice(start, end + 1);
}

function normalizeOne(p: RawPosition): RecommendedJob | null {
  const title = (p.title ?? "").trim();
  if (!title) return null;
  const companyOrIndustry = (
    p.companyContext ??
    p.company_or_industry ??
    ""
  ).trim();
  const whyFit = (p.whyFit ?? p.why_fit ?? p.matchReason ?? "").trim();
  return { title, companyOrIndustry, whyFit };
}

export function parseJobRecommendationsFromReply(reply: string): RecommendedJob[] | null {
  try {
    const raw = JSON.parse(extractJsonSlice(reply)) as RawPayload;
    const list = raw.positions ?? raw.jobs ?? [];
    const out: RecommendedJob[] = [];
    for (const item of list) {
      const n = normalizeOne(item);
      if (n) out.push(n);
      if (out.length >= 3) break;
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}
