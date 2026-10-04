# Starts the backend (port 8000) and the frontend (port 5173) in two windows and opens the browser.
$root = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; & '.\venv\Scripts\python.exe' -m uvicorn app.main:app --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"
Start-Sleep -Seconds 8
Start-Process "http://localhost:5173"
