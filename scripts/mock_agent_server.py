#!/usr/bin/env python3
"""
最小智能体模拟服务：无第三方依赖，用于本地联调前端。

用法：
  python3 scripts/mock_agent_server.py

前端 .env：
  VITE_AGENT_URL=/api/agent
  VITE_AGENT_PROXY_TARGET=http://127.0.0.1:8000
  VITE_AGENT_PROXY_PATH=/chat

默认监听 8000，POST /chat ，与上面 PATH 一致。
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/chat":
            self.send_error(404, "use POST /chat")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            body = {}

        messages = body.get("messages") or []
        ctx = body.get("context") or {}
        mode = ctx.get("mode") or "（未指定）"
        resume = (ctx.get("resume_excerpt") or "")[:500]
        last_user = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user = m.get("content") or ""
                break

        fb = ctx.get("resume_file_base64")
        file_note = ""
        if fb:
            name = ctx.get("resume_file_name") or "（无文件名）"
            mime = ctx.get("resume_file_mime") or ""
            file_note = (
                f"\n附带原始简历文件：{name}（{mime}），base64 长度 {len(fb)}，"
                "可在此解码后交给你的解析工具。\n"
            )

        if mode == "career_jobs":
            snippet = resume[:120].replace("\n", " ")
            reply = json.dumps(
                {
                    "positions": [
                        {
                            "title": "高级后端工程师（平台方向）",
                            "companyContext": "互联网 / 中台与基础架构团队",
                            "whyFit": f"与简历摘录「{snippet[:40]}{'…' if len(snippet) > 40 else ''}」的技能栈相符，可承接高并发与稳定性诉求。",
                        },
                        {
                            "title": "技术负责人（小团队）",
                            "companyContext": "成长期 SaaS / 创业公司",
                            "whyFit": "若简历含带队、交付与跨部门协作经历，可突出端到端交付与节奏把控。",
                        },
                        {
                            "title": "解决方案架构师（偏售前）",
                            "companyContext": "云厂商 / 企业服务公司",
                            "whyFit": "若简历含客户沟通、方案设计与 PoC，可把复杂问题讲清楚作为卖点。",
                        },
                    ]
                },
                ensure_ascii=False,
            )
        else:
            reply = (
                f"【模拟智能体】已收到请求。\n"
                f"场景 mode：{mode}\n"
                f"简历摘录（前 500 字）：{resume[:200]}{'…' if len(resume) > 200 else ''}"
                f"{file_note}\n"
                f"你最后一句：{last_user[:300]}{'…' if len(last_user) > 300 else ''}\n\n"
                "把本脚本换成你的真实大模型调用即可。"
            )

        out = json.dumps({"reply": reply}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


if __name__ == "__main__":
    host, port = "127.0.0.1", 8000
    httpd = HTTPServer((host, port), Handler)
    print(f"Mock agent: http://{host}:{port}/chat  (POST JSON)")
    httpd.serve_forever()
