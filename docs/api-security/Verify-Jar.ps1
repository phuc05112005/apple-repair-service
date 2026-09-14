$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
$project=(Get-Location).Path
$javaPath='C:\Program Files\Java\jdk-21\bin\java.exe'
$jarPath=Join-Path $project 'target\apple-repair-service-0.0.1-SNAPSHOT.jar'
if(!(Test-Path -LiteralPath $jarPath)) {throw 'Packaged JAR missing'}
$prefix='APITESTSMOKE'+[Guid]::NewGuid().ToString('N')
$adminName=$prefix+'admin'
$receptionName=$prefix+'reception'
$rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
$secretBytes=New-Object byte[] 48
$passwordBytes=New-Object byte[] 24
$rng.GetBytes($secretBytes);$rng.GetBytes($passwordBytes);$rng.Dispose()
$jwtSecret=[Convert]::ToBase64String($secretBytes)
$localPassword=[Convert]::ToBase64String($passwordBytes)+'!1'
$appYaml=Get-Content 'src/main/resources/application.yaml' -Raw
$dbPassword=[regex]::Match($appYaml,'(?m)^\s*password:\s*(.+?)\s*$').Groups[1].Value.Trim().Trim([char]34).Trim([char]39)
$temporaryRoot=[IO.Path]::GetTempPath()
$stdout=Join-Path $temporaryRoot ($prefix+'-out.log')
$stderr=Join-Path $temporaryRoot ($prefix+'-err.log')
$previous=@{}
$variables=@{JWT_SECRET=$jwtSecret;BOOTSTRAP_ADMIN_ENABLED='true';BOOTSTRAP_ADMIN_USERNAME=$adminName;
 BOOTSTRAP_ADMIN_PASSWORD=$localPassword;API_DOCS_ENABLED='true';DEBUG='false';MYSQL_PWD=$dbPassword}
$process=$null;$port=$null;$startedTicks=$null
$client=[System.Net.Http.HttpClient]::new()
$client.Timeout=[TimeSpan]::FromSeconds(15)
$checks=[Collections.Generic.List[object]]::new()
$tokens=[Collections.Generic.List[string]]::new()
$cleanupPassed=$false;$stopped=$false;$failure=$null
try {
 foreach($key in $variables.Keys) {
   $previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')
   [Environment]::SetEnvironmentVariable($key,$variables[$key],'Process')
 }
 $process=Start-Process -FilePath $javaPath -WindowStyle Hidden -WorkingDirectory $project -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr -ArgumentList @(
 '-jar',$jarPath,'--server.port=0','--spring.profiles.active=local','--spring.jpa.hibernate.ddl-auto=validate','--spring.jpa.show-sql=false')
 $startedTicks=$process.StartTime.ToUniversalTime().Ticks
 Write-Output ('Owned Java process started: '+$process.Id)
 $deadline=[DateTime]::UtcNow.AddSeconds(60)
 do {
   if($process.HasExited) {throw 'JAR exited before startup'}
   $log=[string]$(if(Test-Path $stdout){Get-Content $stdout -Raw}else{''})
   $match=[regex]::Match($log,'Tomcat started on port (\d+)')
   if($match.Success -and $log -match 'Started AppleRepairServiceApplication') {$port=[int]$match.Groups[1].Value;break}
   Start-Sleep -Milliseconds 400
 } while([DateTime]::UtcNow -lt $deadline)
 if(!$port) {throw 'JAR startup timed out'}
 if($log -match 'Using generated security password') {throw 'Unexpected default security password'}
 Write-Output ('JAR ready on random port '+$port+' with Hibernate validate')
 function Send-Http([string]$method,[string]$path,$body,[string]$token) {
   $request=[System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($method),"http://127.0.0.1:$port$path")
   if($body) {$request.Content=[System.Net.Http.StringContent]::new(($body|ConvertTo-Json -Compress -Depth 8),[Text.Encoding]::UTF8,'application/json')}
   if($token) {$request.Headers.Authorization=[System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$token)}
   try {
     $response=$client.SendAsync($request).GetAwaiter().GetResult()
     try {return [PSCustomObject]@{status=[int]$response.StatusCode;body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()}}
     finally {$response.Dispose()}
   } finally {$request.Dispose()}
 }
 function Expect([string]$name,$response,[int]$expected) {
   $checks.Add([PSCustomObject]@{check=$name;status=$response.status;expected=$expected;pass=($response.status -eq $expected)})
   if($response.status -ne $expected) {throw "HTTP check failed: $name ($($response.status), expected $expected)"}
 }
 $login=$null
 for($attempt=0;$attempt -lt 10;$attempt++) {
   $login=Send-Http 'POST' '/api/v1/auth/login' @{username=$adminName;password=$localPassword} $null
   if($login.status -eq 200) {break}
   Start-Sleep -Milliseconds 400
 }
 Expect 'local bootstrap admin login' $login 200
 $adminToken=($login.body|ConvertFrom-Json).accessToken;$tokens.Add($adminToken)
 Expect 'public catalog' (Send-Http 'GET' '/api/v1/device-types' $null $null) 200
 Expect 'protected without token' (Send-Http 'GET' '/api/v1/admin/users' $null $null) 401
 Expect 'admin authorized' (Send-Http 'GET' '/api/v1/admin/users' $null $adminToken) 200
 Expect 'authenticated me' (Send-Http 'GET' '/api/v1/auth/me' $null $adminToken) 200
 $created=Send-Http 'POST' '/api/v1/admin/users' @{username=$receptionName;password=$localPassword;fullName=$prefix;role='RECEPTIONIST'} $adminToken
 Expect 'admin create receptionist' $created 201
 $receptionId=($created.body|ConvertFrom-Json).id
 $login2=Send-Http 'POST' '/api/v1/auth/login' @{username=$receptionName;password=$localPassword} $null
 Expect 'receptionist login' $login2 200
 $receptionToken=($login2.body|ConvertFrom-Json).accessToken;$tokens.Add($receptionToken)
 Expect 'wrong role denied' (Send-Http 'GET' '/api/v1/admin/users' $null $receptionToken) 403
 Expect 'right receptionist role' (Send-Http 'GET' '/api/v1/internal/appointments' $null $receptionToken) 200
 $docs=Send-Http 'GET' '/v3/api-docs' $null $null
 Expect 'OpenAPI' $docs 200
 $definition=$docs.body|ConvertFrom-Json
 if($definition.components.securitySchemes.bearerAuth.scheme -ne 'bearer') {throw 'Bearer scheme missing'}
 Expect 'Swagger UI HTML' (Send-Http 'GET' '/swagger-ui/index.html' $null $null) 200
 Expect 'Swagger UI JavaScript' (Send-Http 'GET' '/swagger-ui/swagger-ui-bundle.js' $null $null) 200
 Expect 'Swagger configuration' (Send-Http 'GET' '/v3/api-docs/swagger-config' $null $null) 200
 Expect 'deactivate fixture receptionist' (Send-Http 'PUT' "/api/v1/admin/users/$receptionId/status" @{status='INACTIVE'} $adminToken) 200
 Expect 'old token blocked after deactivation' (Send-Http 'GET' '/api/v1/auth/me' $null $receptionToken) 401
 Write-Output ('HTTP smoke checks passed: '+$checks.Count)
} catch { $failure=$_.Exception.Message; Write-Output 'Verification stopped; recording sanitized diagnostics.' }
finally {
 if($process -and !$process.HasExited) {
   $current=Get-Process -Id $process.Id -ErrorAction SilentlyContinue
   if($current -and $current.StartTime.ToUniversalTime().Ticks -eq $startedTicks -and $current.Path -eq $javaPath) {
     $current.Kill();$current.WaitForExit(10000)|Out-Null;$stopped=$current.HasExited
   }
 } elseif($process) {$stopped=$true}
 if($prefix -notmatch '^APITESTSMOKE[a-f0-9]{32}$') {throw 'Unsafe fixture prefix'}
 [Environment]::SetEnvironmentVariable('MYSQL_PWD',$dbPassword,'Process')
 $cleanupSql="DELETE FROM users WHERE username IN ('$adminName','$receptionName'); SELECT COUNT(*) FROM users WHERE username IN ('$adminName','$receptionName');"
 $cleanupResult=& 'C:\Program Files\MySQL\MySQL Server 26.7\bin\mysql.exe' --host=127.0.0.1 --port=3307 --user=root --database=apple_repair_service --default-character-set=utf8mb4 --batch --skip-column-names --execute=$cleanupSql 2>&1
 $cleanupPassed=($LASTEXITCODE -eq 0 -and [string]($cleanupResult|Select-Object -Last 1) -eq '0')
 foreach($key in $variables.Keys) {[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')}
 $safeLog=''
 foreach($path in @($stdout,$stderr)) {
   if(Test-Path -LiteralPath $path) {$safeLog+=(Get-Content -LiteralPath $path -Raw)+"`n"}
 }
 foreach($secret in @($jwtSecret,$localPassword,$dbPassword)+@($tokens)) {if($secret){$safeLog=$safeLog.Replace($secret,'[REDACTED]')}}
 $safeLog | Set-Content 'docs/api-security/final-jar-startup.log' -Encoding UTF8
 $portClosed=$true
 if($port) {
   $socket=[Net.Sockets.TcpClient]::new()
   try {$socket.Connect('127.0.0.1',$port);$portClosed=$false} catch {} finally {$socket.Dispose()}
 }
 [PSCustomObject]@{timestamp=[DateTimeOffset]::Now.ToString('o');processId=if($process){$process.Id}else{$null};port=$port;
   jwtSecretSource='random runtime environment; never persisted';jwtMinimumBytes=32;ddlAuto='validate';
   bootstrap='local profile, explicitly enabled, generated fixture credentials';checks=@($checks.ToArray());
   stoppedOwnedProcess=$stopped;portClosed=$portClosed;fixtureCleanupPassed=$cleanupPassed;failure=$failure} |
   ConvertTo-Json -Depth 8 | Set-Content 'docs/api-security/final-http-smoke.json' -Encoding UTF8
 $client.Dispose()
 Write-Output "Owned process stopped=$stopped; port closed=$portClosed; exact-user cleanup=$cleanupPassed"
}
if($failure -or !$cleanupPassed -or !$stopped -or !$portClosed) {throw 'JAR/HTTP verification failed; inspect sanitized evidence'}
