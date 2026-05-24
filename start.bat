@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8000
echo ==========================================
echo   Floway Tools v2 - Local Dev Server
echo   http://localhost:%PORT%
echo ==========================================

REM 优先用官方 py 启动器(python.org 安装后才有)
where py >nul 2>nul
if %errorlevel%==0 (
    start "" "http://localhost:%PORT%"
    py -3 -m http.server %PORT%
    goto :eof
)

REM 退而求其次:验证 python 是真的可用(排除微软商店占位符)
python -c "import sys" >nul 2>nul
if %errorlevel%==0 (
    start "" "http://localhost:%PORT%"
    python -m http.server %PORT%
    goto :eof
)

echo.
echo [X] 未找到 Python。
echo     请到 https://www.python.org/downloads/ 安装
echo     安装时务必勾选 "Add Python to PATH"
echo.
pause
