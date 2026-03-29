Set-Location "$PSScriptRoot/backend"

$env:DB_ENGINE = 'django.db.backends.sqlite3'
$env:DB_NAME = 'db.sqlite3'
$env:DB_HOST = ''
$env:DB_PORT = ''
$env:DB_USER = ''
$env:DB_PASSWORD = ''
$env:REDIS_URL = 'redis://localhost:6379/0'
$env:QDRANT_URL = 'http://localhost:6333'

& d:/Noty_Brain/.venv/Scripts/python.exe manage.py migrate
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Migration failed.'
  exit $LASTEXITCODE
}

Write-Host "Backend starting on http://localhost:8000"
& d:/Noty_Brain/.venv/Scripts/python.exe manage.py runserver localhost:8000
