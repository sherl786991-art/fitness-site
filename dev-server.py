"""本地预览用的静态服务器：关掉缓存，改完文件刷新就是最新的。

用法（在 fitness-site 目录下）：
    python dev-server.py        # 默认 5173，绑定所有网卡，手机也能连
    python dev-server.py 8000   # 换端口
"""
import functools
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


Handler.extensions_map.update({
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
})

socketserver.TCPServer.allow_reuse_address = True
handler = functools.partial(Handler, directory=ROOT)

with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), handler) as httpd:
    print("serving %s on http://0.0.0.0:%d (no-cache)" % (ROOT, PORT), flush=True)
    httpd.serve_forever()