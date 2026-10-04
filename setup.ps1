# One-time setup for TripNest (Windows PowerShell).
# Run:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Write-Host "TripNest setup" -ForegroundColor Cyan

foreach ($tool in "python", "node", "npm", "psql") {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "'$tool' was not found. Install it and open a new PowerShell window." }
}

# 1. Ask for the PostgreSQL password. EscapeDataString makes characters such as @ safe inside the database URL.
$secure = Read-Host "Enter your PostgreSQL 'postgres' user password" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$encoded = [uri]::EscapeDataString($plain)

# 2. Create the database if it does not exist.
$env:PGPASSWORD = $plain
$exists = & psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='tripnest_db'"
if ($LASTEXITCODE -ne 0) { Remove-Item Env:PGPASSWORD; throw "Could not connect to PostgreSQL. Check the password and that the service is running." }
if (("$exists").Trim() -ne "1") { & psql -U postgres -h localhost -c "CREATE DATABASE tripnest_db;" }
Remove-Item Env:PGPASSWORD

# 3. Write backend\.env
$secret = -join ((48..57) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
@"
DATABASE_URL=postgresql+psycopg2://postgres:$encoded@localhost:5432/tripnest_db
SECRET_KEY=$secret
OTP_DEV_MODE=true
DEMO_MODE=true
"@ | Set-Content -Encoding ascii "$root\backend\.env"

# 4. Backend: virtual environment and packages
Set-Location "$root\backend"
if (-not (Test-Path "venv")) { python -m venv venv }
& .\venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Host "pip install failed. Free some disk space and run setup again." -ForegroundColor Red; exit 1 }

# 5. Frontend packages
Set-Location "$root\frontend"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed. Free some disk space and run setup again." -ForegroundColor Red; exit 1 }

Set-Location $root
Write-Host "Setup complete. Start the app with:  powershell -ExecutionPolicy Bypass -File .\run.ps1" -ForegroundColor Green
