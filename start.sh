#!/bin/bash
# Floway Tools v2 — 本地开发启动脚本
# 用法：./start.sh
# 或直接双击运行

PORT=8000
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  Floway Tools v2 — Local Dev Server"
echo "  http://localhost:$PORT"
echo "=========================================="

# 检查端口占用
if lsof -i :$PORT >/dev/null 2>&1; then
    echo "[!] Port $PORT is occupied, killing old process..."
    lsof -ti :$PORT | xargs kill -9 2>/dev/null
    sleep 0.5
fi

# 启动服务并自动打开浏览器
cd "$DIR"
python3 -m http.server $PORT &
SERVER_PID=$!

# 等待服务就绪
sleep 1

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "[✓] Server running (PID: $SERVER_PID)"

    # 尝试用系统默认浏览器打开
    if command -v cmd.exe &>/dev/null; then
        # WSL 环境 → 调用 Windows 浏览器
        cmd.exe /c start "http://localhost:$PORT" 2>/dev/null
    elif command -v xdg-open &>/dev/null; then
        xdg-open "http://localhost:$PORT" 2>/dev/null
    fi

    echo "[✓] Browser opened at http://localhost:$PORT"
    echo ""
    echo "Press Ctrl+C to stop the server"
else
    echo "[✗] Failed to start server (exit code: $?)"
fi

# 等待服务器进程（Ctrl+C 停止）
wait $SERVER_PID 2>/dev/null
echo ""
echo "[✓] Server stopped"
