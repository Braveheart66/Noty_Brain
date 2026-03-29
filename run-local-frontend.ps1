Set-Location "$PSScriptRoot/frontend"
Write-Host "Frontend starting on http://localhost:5173"
npm run dev -- --host localhost --port 5173
