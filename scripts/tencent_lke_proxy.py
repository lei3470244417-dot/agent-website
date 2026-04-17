#!/usr/bin/env python3
"""
将前端约定的 POST /chat（messages + context）转发到腾讯云 LKE「HTTP SSE」对话接口，
聚合流式 reply 后以 JSON { "reply": "..." } 返回，便于与现有 agentClient 联调。

依赖：仅 Python 标准库。

用法（勿把 AppKey 写进 VITE_ 变量，会打进前端包）：
  export LKE_BOT_APP_KEY="控制台复制的应用 AppKey"
  # 可选：与 session_id 区分访客时填写，默认与 session_id 相同
  # export LKE_VISITOR_BIZ_ID="你的访客标识"

  python3 scripts/tencent_lke_proxy.py

前端 .env（与 mock 相同，只是把 PATH 指向本脚本监听的端口）：
  VITE_AGENT_URL=/api/agent
  VITE_AGENT_PROXY_TARGET=http://127.0.0.1:8000
  VITE_AGENT_PROXY_PATH=/chat

官方文档（请求/返回为 SSE）：
  https://cloud.tencent.com/document/product/1759/105561
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import http.client
import json
import os
import re
import ssl
import urllib.parse
import uuid

LKE_SSE_URL = os.environ.get(
    "LKE_SSE_URL", "https://wss.lke.cloud.tencent.com/v1/qbot/chat/sse"
)
DEFAULT_PORT = 8000


def build_lke_content(messages: list, ctx: dict) -> str:
    """把前端的 messages/context 拼成一条 user content（LKE 单轮上行只有 content）。"""
    blocks = []
    mode = ctx.get("mode")
    resume = (ctx.get("resume_excerpt") or "").strip()
    if mode:
        blocks.append(f"【当前场景】{mode}")
    if resume:
        blocks.append(f"【简历摘录】\n{resume}")
    for m in messages:
        if m.get("role") == "system" and (m.get("content") or "").strip():
            blocks.append(m["content"].strip())
    last_user = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user = (m.get("content") or "").strip()
            break
    if not last_user:
        last_user = "你好"
    if blocks:
        return "\n\n".join(blocks) + "\n\n" + last_user
    return last_user


def parse_sse_collect_reply(raw_bytes: bytes) -> str:
    """
    解析 SSE 流：按行读取 data: 后的 JSON。
    流式下文档说明每次 reply 的 content 为「覆盖式」更新，取最后一次有效的助手侧正文。
    """
    text = raw_bytes.decode("utf-8", errors="replace")
    last_bot = ""
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or not payload.startswith("{"):
            continue
        try:
            obj = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if obj.get("type") == "error":
            err = obj.get("error") or {}
            code = err.get("code", "")
            msg = err.get("message", "unknown error")
            raise RuntimeError(f"LKE error {code}: {msg}")
        if obj.get("type") != "reply":
            continue
        p = obj.get("payload") or {}
        if p.get("is_from_self") is True:
            continue
        content = (p.get("content") or "").strip()
        if not content:
            continue
        # 流式下多次 reply 为覆盖式更新，保留最后一次助手侧 content
        last_bot = p.get("content") or ""
    if not last_bot.strip():
        raise RuntimeError("LKE 响应中未解析到有效 reply 内容，请检查 AppKey / 应用是否已发布")
    return last_bot


def post_lke_sse(body: dict) -> str:
    bot_key = os.environ.get("LKE_BOT_APP_KEY", "").strip()
    if not bot_key:
        raise RuntimeError("请设置环境变量 LKE_BOT_APP_KEY（腾讯云控制台应用 AppKey）")

    parsed = urllib.parse.urlparse(LKE_SSE_URL)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = parsed.path or "/"
    if parsed.query:
        path += "?" + parsed.query

    session_id = body["session_id"]
    visitor = os.environ.get("LKE_VISITOR_BIZ_ID", "").strip() or session_id

    upstream = {
        "request_id": str(uuid.uuid4()),
        "session_id": session_id,
        "bot_app_key": bot_key,
        "visitor_biz_id": visitor,
        "content": body["content"],
        "stream": "enable",
        # false：每次 reply 的 content 为全量（覆盖式）；true 时为增量需拼接，解析更复杂
        "incremental": False,
        "visitor_labels": [],
        "custom_variables": {},
        "search_network": "disable",
    }

    payload = json.dumps(upstream, ensure_ascii=False).encode("utf-8")
    ctx = ssl.create_default_context()
    conn = http.client.HTTPSConnection(host, port, context=ctx, timeout=120)
    try:
        conn.request(
            "POST",
            path,
            body=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
        )
        resp = conn.getresponse()
        raw = resp.read()
        if resp.status < 200 or resp.status >= 300:
            try:
                msg = raw.decode("utf-8", errors="replace")[:2000]
            except Exception:
                msg = ""
            raise RuntimeError(f"LKE HTTP {resp.status}: {msg}")
        return parse_sse_collect_reply(raw)
    finally:
        conn.close()


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
        sid = (ctx.get("lke_session_id") or "").strip()
        if not sid or len(sid) < 2 or len(sid) > 64:
            sid = str(uuid.uuid4())
        # 仅允许文档要求的字符集
        if not re.match(r"^[a-zA-Z0-9_-]{2,64}$", sid):
            sid = str(uuid.uuid4())

        content = build_lke_content(messages, ctx)
        try:
            reply = post_lke_sse({"session_id": sid, "content": content})
        except Exception as e:
            msg = str(e).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self._cors()
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            return

        out = json.dumps({"reply": reply}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


if __name__ == "__main__":
    host, port = "127.0.0.1", int(os.environ.get("LKE_PROXY_PORT", DEFAULT_PORT))
    httpd = HTTPServer((host, port), Handler)
    print(f"LKE proxy: http://{host}:{port}/chat  ->  {LKE_SSE_URL}")
    print("需要环境变量 LKE_BOT_APP_KEY（勿提交到 git）")
    httpd.serve_forever()
