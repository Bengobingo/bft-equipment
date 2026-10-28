@echo off
chcp 65001 >nul
title BFT 本機資料備份
cd /d "%~dp0"
node scripts\local-start.mjs --backup
pause
