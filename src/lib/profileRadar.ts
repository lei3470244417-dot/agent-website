export type RadarDatum = { subject: string; score: number; fullMark: number };

const KEYWORDS: Record<string, string[]> = {
  专业技术: [
    "java",
    "python",
    "go",
    "rust",
    "前端",
    "后端",
    "算法",
    "数据库",
    "架构",
    "微服务",
    "docker",
    "kubernetes",
    "云",
    "开发",
    "工程师",
    "spring",
    "react",
    "vue",
    "node",
  ],
  沟通表达: [
    "沟通",
    "汇报",
    "演讲",
    "客户",
    "需求",
    "协调",
    "文档",
    "培训",
    "分享",
  ],
  团队协作: [
    "团队",
    "协作",
    "敏捷",
    "scrum",
    "git",
    "代码评审",
    "合作",
    "跨部门",
  ],
  学习成长: [
    "学习",
    "自学",
    "认证",
    "课程",
    "论文",
    "专利",
    "开源",
    "竞赛",
  ],
  项目管理: [
    "项目",
    "负责人",
    "里程碑",
    "排期",
    "风险",
    "交付",
    "产品",
    "owner",
    "管理",
  ],
  行业认知: [
    "行业",
    "业务",
    "领域",
    "市场",
    "用户",
    "场景",
    "解决方案",
    "咨询",
  ],
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** 本地启发式画像；接入智能体后可替换为接口返回的 JSON */
export function buildProfileFromResume(text: string): RadarDatum[] {
  const t = text.toLowerCase();
  const base = 42;
  const out: RadarDatum[] = [];

  for (const [subject, words] of Object.entries(KEYWORDS)) {
    let hits = 0;
    for (const w of words) {
      if (t.includes(w.toLowerCase())) hits++;
    }
    const bump = Math.min(38, hits * 6);
    const noise = (subject.length % 7) * 0.8;
    const score = clamp(Math.round(base + bump + noise), 28, 96);
    out.push({ subject, score, fullMark: 100 });
  }

  if (!text.trim()) {
    return out.map((d) => ({ ...d, score: 35 }));
  }

  return out;
}

export function profileSummary(data: RadarDatum[]): string {
  const top = [...data].sort((a, b) => b.score - a.score).slice(0, 2);
  if (!top.length) return "请先粘贴简历正文，生成能力雷达。";
  return `当前突出维度：${top.map((x) => x.subject).join("、")}。可结合智能体建议做针对性提升。`;
}
