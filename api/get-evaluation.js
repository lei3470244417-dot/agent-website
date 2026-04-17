export default async function handler(req, res) {
  // 允许跨域请求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { userName } = req.body;
    // 模拟评价（后续可替换为真实腾讯云调用）
    const evaluation = `${userName || '同学'} 表现优异，逻辑清晰，建议继续深入学习。`;
    return res.status(200).json({ evaluation });
  }

  // GET 请求返回提示
  res.status(200).json({ message: '评价生成 API 已就绪，请使用 POST 请求。' });
}
