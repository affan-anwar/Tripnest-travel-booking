# Drops every table. They are recreated and re-seeded the next time the backend starts.
Set-Location "$PSScriptRoot\backend"
& '.\venv\Scripts\python.exe' -m app.reset_db
