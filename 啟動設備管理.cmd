@echo off
chcp 65001 >nul
title BFT 本機設備管理
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 找不到 Node.js。請先安裝 Node.js 24，再重新啟動。
  pause
  exit /b 1
)
node scripts\local-start.mjs --open
if errorlevel 1 pause
