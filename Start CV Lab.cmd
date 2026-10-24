@echo off
setlocal
cd /d "%~dp0"
echo CV Evidence Lab - replay lokal
echo Buka http://127.0.0.1:8767 setelah server siap.
echo Tutup dengan Ctrl+C. Tidak ada panggilan model baru.
where py >nul 2>nul
if errorlevel 1 goto use_python
py -3 -B server.py
goto finished
:use_python
python -B server.py
:finished
if errorlevel 1 pause
