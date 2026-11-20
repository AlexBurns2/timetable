<#
  Backs up the site's Supabase database to a folder on this computer, outside the repo.

  What it saves: everything in the "public" schema, which is everything the site keeps
  (every table and all its rows, plus the functions, triggers and row-level security the
  site relies on), as one compressed file that pg_restore can put back. Firebase isn't
  included: it only holds live multiplayer rooms, which are thrown away anyway.

  It only reads. Nothing in the database is changed.

  Needs pg_dump (PostgreSQL's command-line tools, version 17 or newer). Run it with:
      powershell -ExecutionPolicy Bypass -File tools\backup-db.ps1
  or choose where it goes:
      powershell -ExecutionPolicy Bypass -File tools\backup-db.ps1 -OutDir "D:\backups"

  It asks for the connection line (Supabase: your project, Connect, "Session pooler") and the
  database password. Neither is saved: not in this file, the backup or your PowerShell history.

  The backup holds real student data (emails, names, timetables, forum posts). Keep it on
  your own drive or a private cloud folder. Never put it in this repo or anywhere public.

  Putting it back: restore into a NEW, empty Supabase project first and check it there.
      pg_restore --no-owner --no-privileges --dbname "<that project's connection line>" msc-public.dump
  (A few "already exists" messages are normal.) Restoring over the live database replaces
  what's there, so don't do that without a careful look first.
#>
param([string]$OutDir)

$repo = Split-Path -Parent $PSScriptRoot

# 1. pg_dump: on the PATH, or wherever the PostgreSQL installer put it (the newest one)
$pgDump = $null
$cmd = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
if ($cmd) { $pgDump = $cmd.Source }
if (-not $pgDump) {
  $found = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending | Select-Object -First 1
  if ($found) { $pgDump = $found.FullName }
}
if (-not $pgDump) {
  Write-Host ''
  Write-Host "pg_dump isn't installed yet. Get PostgreSQL 17 (or newer) for Windows from"
  Write-Host '    https://www.postgresql.org/download/windows/'
  Write-Host 'and in the installer tick only "Command Line Tools" (you do not need the server,'
  Write-Host 'pgAdmin or Stack Builder). Then run this again.'
  exit 1
}
$pgRestore = Join-Path (Split-Path $pgDump) 'pg_restore.exe'

# 2. where it goes: a dated folder beside the repo, never inside it
if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $repo) 'msc-backups' }
$OutDir = [IO.Path]::GetFullPath($OutDir)
$repoFull = [IO.Path]::GetFullPath($repo).TrimEnd('\') + '\'
if (($OutDir.TrimEnd('\') + '\').StartsWith($repoFull, [StringComparison]::OrdinalIgnoreCase)) {
  Write-Host "That folder is inside the repo, so the backup could end up on GitHub. Pick one outside $repo."
  exit 1
}

# 3. the connection: host, port, user and database from the line; the password asked for separately
Write-Host ''
Write-Host 'In Supabase, open your project, press Connect, choose "Session pooler" and copy the line.'
$line = (Read-Host 'Connection line').Trim().Trim('"')
$m = [regex]::Match($line, '^postgres(?:ql)?://([^:@/]+)(?::([^@]*))?@([^:/?]+)(?::(\d+))?/([^?\s]+)')
if (-not $m.Success) {
  Write-Host "That doesn't look like a connection line. It starts with postgresql:// ."
  exit 1
}
$user = $m.Groups[1].Value
$pass = $m.Groups[2].Value
$dbHost = $m.Groups[3].Value
$port = $m.Groups[4].Value
$dbName = $m.Groups[5].Value
if (-not $port) { $port = '5432' }
if ($port -eq '6543') {
  Write-Host 'That is the transaction pooler (port 6543), which pg_dump cannot use. Using the session pooler (port 5432) instead.'
  $port = '5432'
}
if (-not $pass -or $pass -match '^\[.*\]$') {
  $sec = Read-Host 'Database password (it will not show)' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $pass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
} else {
  $pass = [Uri]::UnescapeDataString($pass)
}

# 4. the dump (read-only)
#    each run gets a folder of its own that didn't exist before, so a run never touches an
#    earlier backup (not even one from the same minute), and a failed run only removes its own
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$dest = Join-Path $OutDir $stamp
$n = 2
while (Test-Path -LiteralPath $dest) { $dest = Join-Path $OutDir ($stamp + '_' + $n); $n++ }
New-Item -ItemType Directory -Path $dest | Out-Null
$file = Join-Path $dest 'msc-public.dump'
$env:PGPASSWORD = $pass
$env:PGSSLMODE = 'require'
try {
  Write-Host ''
  Write-Host "Backing up to $file ..."
  & $pgDump --host $dbHost --port $port --username $user --dbname $dbName --schema public `
    --format custom --no-owner --no-privileges --file $file
  $code = $LASTEXITCODE
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
  $pass = $null
}

if ($code -ne 0) {
  Remove-Item -Recurse -Force -Path $dest -ErrorAction SilentlyContinue
  Write-Host ''
  Write-Host 'The backup failed (nothing in the database was changed). The usual reasons:'
  Write-Host ' - the password is wrong. If it is forgotten: Supabase, Project Settings, Database,'
  Write-Host '   Reset database password (the site itself does not use it, so that is safe)'
  Write-Host ' - "server version mismatch": install a newer PostgreSQL, matching or above the database'
  Write-Host ' - it could not connect: use the Session pooler line, not "Direct connection"'
  exit 1
}

# 5. what was saved
$tables = @(& $pgRestore --list $file | Select-String 'TABLE DATA public').Count
$size = (Get-Item $file).Length / 1MB
Write-Host ''
Write-Host ('Done: {0} tables, {1:N1} MB, in {2}' -f $tables, $size, $dest)
Write-Host 'It holds real student data. Keep it private, and never put it in the repo.'
