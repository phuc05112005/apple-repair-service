[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:8080",
    [string]$AdminUsername = "admin",
    [Parameter(Mandatory = $true)][string]$AdminPassword,
    [string]$TechnicianInitialPassword = $(if ($env:TECHNICIAN_INITIAL_PASSWORD) { $env:TECHNICIAN_INITIAL_PASSWORD } else { "123456" }),
    [int]$ScheduleDays = 14,
    [string]$OutputPath = "target/operational-data/seed-summary.json"
)

$ErrorActionPreference = "Stop"
$ApiBaseUrl = $ApiBaseUrl.TrimEnd('/')

function Convert-UnicodeLiteral {
    param([string]$Value)
    return ('"' + $Value + '"' | ConvertFrom-Json)
}

function Invoke-JsonApi {
    param([string]$Method, [string]$Path, [object]$Body, [string]$Token)
    $headers = @{ Accept = "application/json" }
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $parameters = @{ Method = $Method; Uri = "$ApiBaseUrl$Path"; Headers = $headers; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $parameters.ContentType = "application/json; charset=utf-8"
        $parameters.Body = $Body | ConvertTo-Json -Depth 10 -Compress
    }
    try {
        $webResponse = Invoke-WebRequest @parameters
        if (-not $webResponse.RawContentStream -or $webResponse.RawContentStream.Length -eq 0) {
            return $null
        }
        $rawBytes = $webResponse.RawContentStream.ToArray()
        $response = [System.Text.Encoding]::UTF8.GetString($rawBytes) | ConvertFrom-Json
    } catch {
        $details = ""
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $details = $reader.ReadToEnd()
            $reader.Dispose()
        }
        throw "API $Method $Path failed with status=$statusCode. $details"
    }
    # Windows PowerShell keeps a JSON root array as one Object[] value when it
    # crosses a function boundary. Emit its items explicitly for @(...).
    if ($response -is [System.Array]) {
        foreach ($item in $response) { Write-Output $item }
        return
    }
    return $response
}

$login = Invoke-JsonApi POST "/api/v1/auth/login" @{ username = $AdminUsername; password = $AdminPassword } $null
$token = $login.accessToken
if (-not $token) { throw "Admin login did not return an access token." }

$deviceTypes = @(Invoke-JsonApi GET "/api/v1/admin/device-types" $null $token)
$typeByName = @{}
foreach ($type in $deviceTypes) { $typeByName[$type.name.ToLowerInvariant()] = $type }

$wantedModels = [ordered]@{
    "iPhone" = @("11","11 Pro","11 Pro Max","12","12 mini","12 Pro","12 Pro Max","13","13 mini","13 Pro","13 Pro Max","14","14 Plus","15 Plus")
    "iPad" = @(
        (Convert-UnicodeLiteral 'iPad th\u1EBF h\u1EC7 9'), (Convert-UnicodeLiteral 'iPad th\u1EBF h\u1EC7 10'),
        (Convert-UnicodeLiteral 'iPad mini th\u1EBF h\u1EC7 6'), (Convert-UnicodeLiteral 'iPad Air th\u1EBF h\u1EC7 4'),
        (Convert-UnicodeLiteral 'iPad Air th\u1EBF h\u1EC7 5'), "iPad Pro 11 inch", "iPad Pro 12.9 inch"
    )
    "MacBook" = @("MacBook Air M1","MacBook Air M2 13 inch","MacBook Air M2 15 inch","MacBook Air M3 13 inch","MacBook Air M3 15 inch","MacBook Pro 13 inch M1","MacBook Pro 14 inch M1 Pro","MacBook Pro 16 inch M1 Pro","MacBook Pro 14 inch M2 Pro","MacBook Pro 16 inch M2 Pro","MacBook Pro 14 inch M3","MacBook Pro 16 inch M3 Pro")
    "Apple Watch" = @("Apple Watch Series 6","Apple Watch Series 7","Apple Watch Series 8","Apple Watch SE",(Convert-UnicodeLiteral 'Apple Watch SE th\u1EBF h\u1EC7 2'),"Apple Watch Ultra","Apple Watch Ultra 2")
    "AirPods" = @(
        (Convert-UnicodeLiteral 'AirPods th\u1EBF h\u1EC7 1'), (Convert-UnicodeLiteral 'AirPods th\u1EBF h\u1EC7 2'),
        (Convert-UnicodeLiteral 'AirPods th\u1EBF h\u1EC7 3'), (Convert-UnicodeLiteral 'AirPods Pro th\u1EBF h\u1EC7 1'),
        (Convert-UnicodeLiteral 'AirPods Pro th\u1EBF h\u1EC7 2'), "AirPods Max"
    )
}

$modelsBefore = @(Invoke-JsonApi GET "/api/v1/admin/device-models" $null $token)
$existingModelKeys = @{}
foreach ($model in $modelsBefore) { $existingModelKeys["$($model.deviceTypeId)|$($model.name.ToLowerInvariant())"] = $true }
$addedModels = [System.Collections.Generic.List[object]]::new()
$skippedModels = [System.Collections.Generic.List[object]]::new()

foreach ($entry in $wantedModels.GetEnumerator()) {
    $type = $typeByName[$entry.Key.ToLowerInvariant()]
    if (-not $type) { throw "Missing required device type: $($entry.Key)" }
    foreach ($name in $entry.Value) {
        $key = "$($type.id)|$($name.ToLowerInvariant())"
        if ($existingModelKeys.ContainsKey($key)) {
            $skippedModels.Add([ordered]@{ deviceType = $entry.Key; name = $name; reason = "ALREADY_EXISTS" })
            continue
        }
        $created = Invoke-JsonApi POST "/api/v1/admin/device-models" @{ deviceTypeId = $type.id; name = $name } $token
        $existingModelKeys[$key] = $true
        $addedModels.Add([ordered]@{ id = $created.id; deviceType = $entry.Key; name = $created.name })
    }
}

$technicianNames = @(
    (Convert-UnicodeLiteral 'Nguy\u1EC5n Minh Ho\u00E0ng'), (Convert-UnicodeLiteral 'Tr\u1EA7n Qu\u1ED1c Huy'),
    (Convert-UnicodeLiteral 'L\u00EA \u0110\u1EE9c Anh'), (Convert-UnicodeLiteral 'Ph\u1EA1m Gia B\u1EA3o'),
    (Convert-UnicodeLiteral 'V\u00F5 Th\u00E0nh \u0110\u1EA1t'), (Convert-UnicodeLiteral 'Nguy\u1EC5n Nh\u1EADt Minh'),
    (Convert-UnicodeLiteral 'Tr\u1EA7n Ho\u00E0ng Nam'), (Convert-UnicodeLiteral 'L\u00EA Quang Huy'),
    (Convert-UnicodeLiteral 'Ph\u1EA1m Minh Tu\u1EA5n'), (Convert-UnicodeLiteral '\u0110\u1EB7ng Qu\u1ED1c Kh\u00E1nh')
)
$branches = @(Invoke-JsonApi GET "/api/v1/admin/branches" $null $token | Where-Object status -eq "ACTIVE")
if ($branches.Count -eq 0) { throw "No active branch is available for technician schedules." }
$users = @(Invoke-JsonApi GET "/api/v1/admin/users" $null $token)
$userByUsername = @{}
foreach ($user in $users) { $userByUsername[$user.username.ToLowerInvariant()] = $user }
$technicians = [System.Collections.Generic.List[object]]::new()

for ($index = 0; $index -lt 10; $index++) {
    $username = "ktv{0:D2}" -f ($index + 1)
    $fullName = $technicianNames[$index]
    $existing = $userByUsername[$username]
    $createdNow = $false
    if (-not $existing) {
        $existing = Invoke-JsonApi POST "/api/v1/admin/users" @{
            username = $username; password = $TechnicianInitialPassword; fullName = $fullName
            phone = $null; role = "TECHNICIAN"; status = "ACTIVE"
        } $token
        $createdNow = $true
    } else {
        if ($existing.fullName -ne $fullName) { $existing = Invoke-JsonApi PUT "/api/v1/admin/users/$($existing.id)/profile" @{ fullName = $fullName; phone = $existing.phone } $token }
        if ($existing.role -ne "TECHNICIAN") { $existing = Invoke-JsonApi PUT "/api/v1/admin/users/$($existing.id)/role" @{ role = "TECHNICIAN" } $token }
        if ($existing.status -ne "ACTIVE") { $existing = Invoke-JsonApi PUT "/api/v1/admin/users/$($existing.id)/status" @{ status = "ACTIVE" } $token }
    }
    $branch = $branches[$index % $branches.Count]
    $technicians.Add([ordered]@{ id = $existing.id; username = $username; fullName = $fullName; branchId = $branch.id; branchName = $branch.name; created = $createdNow })
}

$today = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "SE Asia Standard Time").Date
$schedulesCreated = 0
$schedulesExisting = 0
foreach ($technician in $technicians) {
    for ($offset = 0; $offset -lt $ScheduleDays; $offset++) {
        $date = $today.AddDays($offset)
        if ($offset -gt 0 -and $date.DayOfWeek -eq [DayOfWeek]::Sunday) { continue }
        $start = if ($offset -eq 0) { "00:00:00" } else { "08:00:00" }
        $end = if ($offset -eq 0) { "23:59:59" } else { "17:00:00" }
        $dateText = $date.ToString("yyyy-MM-dd")
        $existingSchedules = @(Invoke-JsonApi GET "/api/v1/admin/technician-schedules?technicianId=$($technician.id)&date=$dateText" $null $token)
        $match = $existingSchedules | Where-Object {
            $_.branchId -eq $technician.branchId -and $_.status -eq "WORKING" -and
            $_.startTime.StartsWith($start.Substring(0,5)) -and $_.endTime.StartsWith($end.Substring(0,5))
        }
        if ($match) { $schedulesExisting++; continue }
        Invoke-JsonApi POST "/api/v1/admin/technician-schedules" @{
            technicianId = $technician.id; branchId = $technician.branchId; workDate = $dateText
            startTime = $start; endTime = $end; status = "WORKING"
        } $token | Out-Null
        $schedulesCreated++
    }
}

$loginVerification = [System.Collections.Generic.List[object]]::new()
foreach ($username in @("ktv01", "ktv02")) {
    $employeeLogin = Invoke-JsonApi POST "/api/v1/auth/login" @{ username = $username; password = $TechnicianInitialPassword } $null
    $me = Invoke-JsonApi GET "/api/v1/auth/me" $null $employeeLogin.accessToken
    $adminForbidden = $false
    try { Invoke-JsonApi GET "/api/v1/admin/users" $null $employeeLogin.accessToken | Out-Null }
    catch { $adminForbidden = $_.Exception.Message -match 'status=403' }
    $receptionistForbidden = $false
    try { Invoke-JsonApi GET "/api/v1/internal/appointments" $null $employeeLogin.accessToken | Out-Null }
    catch { $receptionistForbidden = $_.Exception.Message -match 'status=403' }
    $loginVerification.Add([ordered]@{ username = $username; login = $true; role = $me.role; adminForbidden = $adminForbidden; receptionistForbidden = $receptionistForbidden })
}

$modelsAfter = @(Invoke-JsonApi GET "/api/v1/admin/device-models" $null $token)
$publicVerification = [System.Collections.Generic.List[object]]::new()
foreach ($entry in $wantedModels.GetEnumerator()) {
    $type = $typeByName[$entry.Key.ToLowerInvariant()]
    $sampleName = $entry.Value[0]
    $sample = $modelsAfter | Where-Object { $_.deviceTypeId -eq $type.id -and $_.name -eq $sampleName } | Select-Object -First 1
    $issues = @(Invoke-JsonApi GET "/api/v1/service-issues?deviceTypeId=$($type.id)" $null $null)
    $catalog = @()
    if ($sample) { $catalog = @(Invoke-JsonApi GET "/api/v1/service-catalog-items?deviceModelId=$($sample.id)" $null $null) }
    $publicVerification.Add([ordered]@{
        deviceType = $entry.Key; model = $sampleName; modelVisible = [bool]$sample; issueCount = $issues.Count
        catalogCount = $catalog.Count; catalogStatus = $(if ($catalog.Count) { "AVAILABLE" } else { "MISSING_CATALOG_MAPPING_REQUIRES_BUSINESS_INPUT" })
    })
}

$summary = [ordered]@{
    generatedAt = [DateTimeOffset]::Now.ToString("o")
    apiBaseUrl = $ApiBaseUrl
    modelCountBefore = $modelsBefore.Count
    modelCountAfter = $modelsAfter.Count
    modelsAdded = @($addedModels)
    modelsSkipped = @($skippedModels)
    technicians = @($technicians)
    schedulesCreated = $schedulesCreated
    schedulesAlreadyPresent = $schedulesExisting
    loginVerification = @($loginVerification)
    publicVerification = @($publicVerification)
}
$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) { New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null }
$summary | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $OutputPath
$summary | ConvertTo-Json -Depth 10
