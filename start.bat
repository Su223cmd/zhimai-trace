@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title GraphAgent - 知识图谱驱动的多Agent学情诊断引擎

echo ========================================
echo   GraphAgent
echo   知识图谱驱动的多Agent学情诊断与
echo   CDM根因追溯引擎
echo ========================================
echo.

set "ROOT=%~dp0"
set "PY_DIR=%ROOT%python"
set "PY_ZIP=%ROOT%python-embed.zip"
set "PY_VER=3.12.9"
set "PY_URL=https://www.python.org/ftp/python/%PY_VER%/python-%PY_VER%-embed-amd64.zip"
set "GETPIP_URL=https://bootstrap.pypa.io/get-pip.py"
set "REQ_FILE=%ROOT%backend\requirements.txt"

:: ========== Step 1: Find Python ==========

set "PYTHON="

:: 1a. Prefer embedded Python (consistent environment)
if exist "%PY_DIR%\python.exe" (
    set "PYTHON=%PY_DIR%\python.exe"
    echo [OK] 使用内置 Python
    goto :python_found
)

:: 1b. Try system Python
where python >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do set "PY_VER_CHECK=%%v"
    echo !PY_VER_CHECK! | findstr /r "3\.1[0-9]" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON=python"
        echo [OK] 检测到系统 Python: !PY_VER_CHECK!
        goto :python_found
    )
)

:: 1c. Auto-download embedded Python
echo [!] 未检测到合适的 Python，正在自动下载便携版...
echo     首次运行需要联网下载（约 15MB），请耐心等待...
echo.

echo [1/4] 下载 Python %PY_VER%...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '!PY_URL!' -OutFile '!PY_ZIP!'" 2>nul
if not exist "%PY_ZIP%" (
    echo.
    echo [错误] Python 下载失败，请检查网络连接
    echo   手动安装方式: 安装 Python 3.10+ 后重试
    echo   下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [2/4] 解压 Python...
mkdir "%PY_DIR%" 2>nul
powershell -Command "$ProgressPreference='SilentlyContinue'; Expand-Archive -Path '!PY_ZIP!' -DestinationPath '!PY_DIR!' -Force" 2>nul
del "%PY_ZIP%" 2>nul

echo [3/4] 配置 pip 环境...
:: Enable site-packages in embedded Python
for %%f in ("%PY_DIR%\*._pth") do (
    powershell -Command "$c = Get-Content '%%f'; $c = $c -replace '#import site', 'import site'; $c = $c -replace '#Lib\\site-packages', 'Lib\site-packages'; Set-Content -Path '%%f' -Value $c"
)

echo [4/4] 安装 pip...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '!GETPIP_URL!' -OutFile '!PY_DIR!\get-pip.py'" 2>nul
"%PY_DIR%\python.exe" "%PY_DIR%\get-pip.py" --no-warn-script-location 2>nul
del "%PY_DIR%\get-pip.py" 2>nul

set "PYTHON=%PY_DIR%\python.exe"
echo [OK] Python %PY_VER% 安装完成
echo.

:python_found

:: ========== Step 2: Show version ==========
"%PYTHON%" --version

:: ========== Step 3: Install dependencies ==========
echo.
echo [*] 安装依赖包（首次可能需要 1-3 分钟）...
"%PYTHON%" -m pip install -r "%REQ_FILE%" -q --no-warn-script-location
if !errorlevel! neq 0 (
    echo.
    echo [错误] 依赖安装失败，请检查网络连接后重试
    pause
    exit /b 1
)
echo [OK] 依赖安装完成

:: ========== Step 4: Start server ==========
echo.
echo ========================================
echo   服务已启动!
echo   请在浏览器中访问:
echo.
echo       http://localhost:8000
echo.
echo   按 Ctrl+C 停止服务
echo ========================================
echo.

cd /d "%ROOT%backend"
"%PYTHON%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000

echo.
echo 服务已停止
pause
