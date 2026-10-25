@echo off
chcp 65001 >nul
title BFT 停止本機系統
cd /d "%~dp0"
node scripts\local-start.mjs --stop
if errorlevel 1 pause
