# Dev-only: update the password hash of ONE admin account in the local dev database.
#
# Dry-run (default, writes nothing):  .\scripts\dev\reset_admin_password.ps1
# Apply (only after owner confirmation): .\scripts\dev\reset_admin_password.ps1 -Apply
#
# Safety:
# - Never prints the password, the hash, or the root password.
# - Secrets are read from .env into process-local variables only.
# - Refuses any database other than apple_repair_service and any username other than admin.
# - Hashes with the project's own BCryptPasswordEncoder(12) (PasswordConfig).
# - The hash is sent to MySQL via stdin, not on the command line.
# - Updates only password_hash/updated_at of exactly one ADMIN row, in one transaction.
[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$Database = 'apple_repair_service',
    [string]$Username = 'admin',
    [string]$Container = 'apple-mysql'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

if ($Database -ne 'apple_repair_service') { throw "Refusing: '$Database' is not the approved dev database." }
if ($Username -ne 'admin') { throw 'Refusing: only the admin account may be updated by this script.' }

function Get-EnvValue([string]$Key) {
    $line = Get-Content .env | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
    if (-not $line) { throw "$Key is not defined in .env" }
    return ($line -replace "^\s*$Key\s*=", '')
}

$adminPwd = Get-EnvValue 'BOOTSTRAP_ADMIN_PASSWORD'
# The container's root password can differ from .env (.env MYSQL_ROOT_PASSWORD is stale for apple-mysql).
# Use the session variable DEV_MYSQL_ROOT_PASSWORD; never stored in this file.
$rootPwd = $env:DEV_MYSQL_ROOT_PASSWORD
if (-not $rootPwd) { throw 'Set DEV_MYSQL_ROOT_PASSWORD in this PowerShell session (not in any file) and re-run.' }
if ($adminPwd.Length -lt 6 -or $adminPwd.Length -gt 72) { throw 'Password must be 6..72 characters.' }
if ([System.Text.Encoding]::UTF8.GetByteCount($adminPwd) -gt 72) { throw 'Password exceeds 72 UTF-8 bytes.' }

# Compile a tiny helper against the project's Spring Security jars (cached in TEMP).
$dir = Join-Path $env:TEMP 'kilo\pwhelper'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$jars = @(
  (Get-ChildItem "$env:USERPROFILE\.m2\repository\org\springframework\security\spring-security-crypto" -Recurse -Filter *.jar | Where-Object { $_.Name -notmatch 'sources' } | Select-Object -First 1).FullName,
  (Get-ChildItem "$env:USERPROFILE\.m2\repository\org\springframework\spring-core" -Recurse -Filter *.jar | Select-Object -First 1).FullName,
  (Get-ChildItem "$env:USERPROFILE\.m2\repository\commons-logging" -Recurse -Filter *.jar -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
) -join ';'
$helperSrc = @'
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
public class PwHelper {
  public static void main(String[] a) {
    String pw = System.getenv("PW_RAW");
    BCryptPasswordEncoder enc = new BCryptPasswordEncoder(12);
    if (a[0].equals("hash")) { System.out.print(enc.encode(pw)); }
    else { System.out.print(enc.matches(pw, System.getenv("PW_HASH"))); }
  }
}
'@
Set-Content -Path (Join-Path $dir 'PwHelper.java') -Value $helperSrc -Encoding ASCII
& "C:\Program Files\Java\jdk-21\bin\javac.exe" -cp $jars -d $dir (Join-Path $dir 'PwHelper.java') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Helper compile failed; no changes made.' }
$cp = "$dir;$jars"

function MysqlQuery([string]$Sql) {
    $env:MYSQL_PWD = $rootPwd
    try { return (docker exec -e MYSQL_PWD $Container mysql -uroot -N -B -e $Sql 2>$null) }
    finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
}

Write-Output '--- TARGET (non-sensitive) ---'
Write-Output "database : $Database"
Write-Output "table    : users"
Write-Output "username : $Username"
$rows = MysqlQuery "SELECT id, role, status, CHAR_LENGTH(password_hash) FROM $Database.users WHERE username='$Username';"
Write-Output "matching rows (id, role, status, hash_len): $rows"
$count = @($rows | Where-Object { $_ -ne '' }).Count
if ($count -ne 1) { throw "Expected exactly 1 row for '$Username', found $count. Aborting." }
if (($rows -split "`t")[1] -ne 'ADMIN') { throw 'Target row is not role ADMIN. Aborting.' }

# Does the new password already match the stored hash? (True/False only)
$storedHash = (MysqlQuery "SELECT password_hash FROM $Database.users WHERE username='$Username';").Trim()
$env:PW_RAW = $adminPwd; $env:PW_HASH = $storedHash
$alreadyMatches = (& "C:\Program Files\Java\jdk-21\bin\java.exe" -cp $cp PwHelper check 2>$null)
Remove-Item Env:PW_HASH -ErrorAction SilentlyContinue
Write-Output "stored hash already matches .env password: $alreadyMatches"
if ($alreadyMatches -eq 'true') { Remove-Item Env:PW_RAW -ErrorAction SilentlyContinue; Write-Output 'No change needed.'; exit 0 }

$newHash = (& "C:\Program Files\Java\jdk-21\bin\java.exe" -cp $cp PwHelper hash 2>$null).Trim()
Remove-Item Env:PW_RAW -ErrorAction SilentlyContinue
if ($newHash -notmatch '^\$2a\$12\$[./A-Za-z0-9]{53}$') { throw 'Generated value is not a cost-12 BCrypt hash; aborting.' }

if (-not $Apply) {
    Write-Output 'DRY-RUN: nothing written. Re-run with -Apply after owner confirmation.'
    exit 0
}

$sql = "START TRANSACTION; UPDATE $Database.users SET password_hash='$newHash', updated_at=NOW(6) WHERE username='$Username' AND role='ADMIN'; SELECT ROW_COUNT(); COMMIT;"
$env:MYSQL_PWD = $rootPwd
try { $out = ($sql | docker exec -i -e MYSQL_PWD $Container mysql -uroot -N -B $Database 2>$null) }
finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
Write-Output "update result (rows affected): $out"

# Post-write verification against the .env password (True/False only).
$verifyHash = (MysqlQuery "SELECT password_hash FROM $Database.users WHERE username='$Username';").Trim()
$env:PW_RAW = $adminPwd; $env:PW_HASH = $verifyHash
$ok = (& "C:\Program Files\Java\jdk-21\bin\java.exe" -cp $cp PwHelper check 2>$null)
Remove-Item Env:PW_RAW,Env:PW_HASH -ErrorAction SilentlyContinue
Write-Output "post-write verification matches .env password: $ok"
