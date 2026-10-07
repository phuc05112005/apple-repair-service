[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:8080",
    [string]$AdminUsername = "admin",
    [Parameter(Mandatory = $true)][string]$AdminPassword,
    [switch]$AllowCanonical,
    [string]$OutputPath = "target/operational-data/service-catalog-seed-summary.json"
)

# Seeds only master data through the public Admin REST surface.  It intentionally
# does not create customers, appointments, tickets, usages, or ML predictions.
$ErrorActionPreference = "Stop"
$ApiBaseUrl = $ApiBaseUrl.TrimEnd('/')
if ($ApiBaseUrl -match '^https?://(localhost|127\.0\.0\.1):8080$' -and -not $AllowCanonical) {
    throw "Refusing to write canonical master data without -AllowCanonical."
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
        $response = Invoke-WebRequest @parameters
        if (-not $response.RawContentStream -or $response.RawContentStream.Length -eq 0) { return $null }
        $bodyText = [System.Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
        $parsed = $bodyText | ConvertFrom-Json
        if ($parsed -is [System.Array]) { foreach ($item in $parsed) { Write-Output $item }; return }
        return $parsed
    } catch {
        $statusCode = $null; $details = ""
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $details = $reader.ReadToEnd(); $reader.Dispose()
        }
        throw "API $Method $Path failed with status=$statusCode. $details"
    }
}

function U([string]$Value) {
    return ('"' + $Value + '"' | ConvertFrom-Json)
}
function Key([object]$Value) {
    $text = ([string]$Value).Trim()
    # The canonical DB predates UTF-8 cleanup for two issue labels.  Read those
    # labels semantically without rewriting user-owned issue master data.
    if ($text -match '[^\x00-\x7F]') {
        try {
            $candidate = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::GetEncoding(1252).GetBytes($text))
            if ($candidate) { $text = $candidate }
        } catch { }
    }
    return $text.ToLowerInvariant()
}
function CatalogKey([long]$ModelId, [long]$TypeId, [long]$IssueId, [object]$PartId) {
    return "${ModelId}|${TypeId}|${IssueId}|$([string]$PartId)"
}

$login = Invoke-JsonApi POST "/api/v1/auth/login" @{ username = $AdminUsername; password = $AdminPassword } $null
$token = $login.accessToken
if (-not $token) { throw "Admin login did not return an access token." }
$actorId = $login.user.id

$types = @(Invoke-JsonApi GET "/api/v1/admin/device-types" $null $token | Where-Object status -eq "ACTIVE")
$models = @(Invoke-JsonApi GET "/api/v1/admin/device-models" $null $token | Where-Object status -eq "ACTIVE")
$issues = @(Invoke-JsonApi GET "/api/v1/admin/service-issues" $null $token | Where-Object status -eq "ACTIVE")
$serviceTypes = @(Invoke-JsonApi GET "/api/v1/admin/service-types" $null $token | Where-Object status -eq "ACTIVE")
$parts = @(Invoke-JsonApi GET "/api/v1/admin/parts" $null $token)
$catalog = @(Invoke-JsonApi GET "/api/v1/admin/service-catalog-items" $null $token)
$branches = @(Invoke-JsonApi GET "/api/v1/admin/branches" $null $token | Where-Object status -eq "ACTIVE")
if ($branches.Count -eq 0) { throw "No active branch is available for catalog demo inventory." }

$typeByName = @{}; foreach ($type in $types) { $typeByName[(Key $type.name)] = $type }
$issueByName = @{}; foreach ($issue in $issues) { $issueByName[(Key $issue.name)] = $issue }
$serviceTypeByCode = @{}; foreach ($type in $serviceTypes) { $serviceTypeByCode[$type.code] = $type }
$issuePin = U 'Pin'
$issueCamera = U 'Camera'
$issueCharge = U 'S\u1ea1c'
$issueScreen = U 'M\u00e0n h\u00ecnh'
$issueSpeaker = U 'Loa'
foreach ($required in @("iPhone", "iPad", "MacBook", "Apple Watch", "AirPods")) {
    if (-not $typeByName.ContainsKey((Key $required))) { throw "Missing active device type: $required" }
}
foreach ($required in @($issuePin, $issueCamera, $issueCharge, $issueScreen, $issueSpeaker)) {
    if (-not $issueByName.ContainsKey((Key $required))) { throw "Missing active service issue: $required" }
}
foreach ($required in @("REPAIR", "REPLACEMENT")) {
    if (-not $serviceTypeByCode.ContainsKey($required)) { throw "Missing active service type: $required" }
}

$partByCode = @{}; foreach ($part in $parts) { $partByCode[(Key $part.partCode)] = $part }
$catalogByKey = @{}
foreach ($item in $catalog) { $catalogByKey[(CatalogKey $item.deviceModelId $item.serviceTypeId $item.serviceIssueId $item.partId)] = $item }

$createdParts = [System.Collections.Generic.List[object]]::new()
$createdRepairCatalog = [System.Collections.Generic.List[object]]::new()
$createdReplacementCatalog = [System.Collections.Generic.List[object]]::new()
$inventoryLotsCreated = [System.Collections.Generic.List[object]]::new()

function Ensure-Part([hashtable]$Definition) {
    $code = Key $Definition.code
    if ($partByCode.ContainsKey($code)) { return $partByCode[$code] }
    $created = Invoke-JsonApi POST "/api/v1/admin/parts" @{
        partCode = $Definition.code; name = $Definition.name; brand = $Definition.brand
        variant = $Definition.variant; salePrice = [decimal]$Definition.price
    } $token
    $partByCode[$code] = $created; $createdParts.Add($created)
    return $created
}

function Ensure-Catalog([object]$Model, [object]$Issue, [object]$Type, [object]$Part, [hashtable]$Definition, [bool]$Replacement) {
    $partId = if ($null -eq $Part) { $null } else { $Part.id }
    $key = CatalogKey $Model.id $Type.id $Issue.id $partId
    if ($catalogByKey.ContainsKey($key)) { return $catalogByKey[$key] }
    $created = Invoke-JsonApi POST "/api/v1/admin/service-catalog-items" @{
        deviceModelId = $Model.id; serviceTypeId = $Type.id; serviceIssueId = $Issue.id; partId = $partId
        name = $null; configuredPrice = [decimal]$Definition.price; standardDurationMinutes = [int]$Definition.duration
        warrantyDays = [int]$Definition.warrantyDays; warrantyRemedy = $Definition.warrantyRemedy; warrantyReplacementCatalogId = $null
    } $token
    $catalogByKey[$key] = $created
    if ($Replacement) { $createdReplacementCatalog.Add($created) } else { $createdRepairCatalog.Add($created) }
    return $created
}

function Ensure-DemoInventory([object]$Part) {
    $branch = $branches[0]
    $inventory = Invoke-JsonApi GET "/api/v1/admin/inventory?branchId=$($branch.id)&partId=$($Part.id)" $null $token
    $quantity = if ($null -eq $inventory) { 0 } else { [int]$inventory.quantity }
    if ($quantity -ge 3) { return }
    $lotCode = "CATALOG-V1-$($Part.partCode)"
    $existingLots = @(Invoke-JsonApi GET "/api/v1/admin/inventory/lots?branchId=$($branch.id)&partId=$($Part.id)" $null $token)
    if ($existingLots | Where-Object { $_.lotCode -ieq $lotCode }) { return }
    $needed = 3 - $quantity
    $receivedAt = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "SE Asia Standard Time").ToString("yyyy-MM-ddTHH:mm:ss")
    Invoke-JsonApi POST "/api/v1/admin/inventory/stock-in" @{
        lotCode = $lotCode; branchId = $branch.id; partId = $Part.id; quantity = $needed; receivedAt = $receivedAt
        sourceNote = "Catalog completion demo stock v1"
    } $token | Out-Null
    $inventoryLotsCreated.Add([ordered]@{ lotCode=$lotCode; branchId=$branch.id; partCode=$Part.partCode; quantity=$needed })
}

# Repair prices are internal TáoCare demo list prices. They are deliberately explicit,
# pre-discount, and independent from ETA / ML prediction.  Every applicable active
# model receives exactly one repair option per existing applicable issue.
$repairByType = @{
    "iphone" = @{ (Key $issuePin)=@{price=690000;duration=45;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueCamera)=@{price=650000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueCharge)=@{price=550000;duration=45;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueScreen)=@{price=900000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueSpeaker)=@{price=450000;duration=45;warrantyDays=90;warrantyRemedy="REPAIR"} }
    "ipad" = @{ (Key $issuePin)=@{price=790000;duration=75;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueCamera)=@{price=700000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueCharge)=@{price=650000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueScreen)=@{price=1200000;duration=90;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueSpeaker)=@{price=500000;duration=45;warrantyDays=90;warrantyRemedy="REPAIR"} }
    "macbook" = @{ (Key $issuePin)=@{price=1200000;duration=90;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueCamera)=@{price=700000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueCharge)=@{price=600000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueScreen)=@{price=1800000;duration=120;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueSpeaker)=@{price=650000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"} }
    "apple watch" = @{ (Key $issuePin)=@{price=490000;duration=45;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueCharge)=@{price=350000;duration=30;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueScreen)=@{price=1200000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueSpeaker)=@{price=400000;duration=45;warrantyDays=90;warrantyRemedy="REPAIR"} }
    "airpods" = @{ (Key $issuePin)=@{price=400000;duration=45;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueCharge)=@{price=350000;duration=45;warrantyDays=90;warrantyRemedy="REPAIR"}; (Key $issueSpeaker)=@{price=450000;duration=60;warrantyDays=90;warrantyRemedy="REPAIR"} }
}

foreach ($model in $models) {
    $deviceType = $types | Where-Object id -eq $model.deviceTypeId | Select-Object -First 1
    $rules = $repairByType[(Key $deviceType.name)]
    if ($null -eq $rules) { continue }
    foreach ($issue in $issues) {
        if ($issue.deviceTypeIds -notcontains $deviceType.id) { continue }
        $rule = $rules[(Key $issue.name)]
        if ($null -eq $rule) { continue }
        Ensure-Catalog $model $issue $serviceTypeByCode["REPAIR"] $null $rule $false | Out-Null
    }
}

# Each entry below has either a direct product/service reference or uses the
# official Apple service-replacement semantics without claiming an Apple price.
$replacementDefinitions = @(
    @{type="iPhone";model="13";issue=$issuePin;code="BAT-IP13-DEJI-STD-3227";name=(U 'Pin iPhone 13');brand="Deji";variant=(U 'Dung l\u01b0\u1ee3ng chu\u1ea9n 3227mAh');price=690000;duration=30;warrantyDays=365;warrantyRemedy="REPLACEMENT"},
    @{type="iPhone";model="13";issue=$issuePin;code="BAT-IP13-DEJI-HC-3510";name=(U 'Pin iPhone 13');brand="Deji";variant=(U 'Dung l\u01b0\u1ee3ng cao 3510mAh');price=780000;duration=30;warrantyDays=365;warrantyRemedy="REPLACEMENT"},
    @{type="iPhone";model="13";issue=$issueScreen;code="SCR-IP13-DEJI-OLED";name=(U 'M\u00e0n h\u00ecnh iPhone 13 OLED');brand="Deji";variant="OLED";price=1500000;duration=45;warrantyDays=180;warrantyRemedy="REPLACEMENT"},
    @{type="iPad";model=(U 'iPad th\u1ebf h\u1ec7 9');issue=$issuePin;code="BAT-IPAD9-APPLE-SVC";name=(U 'Pin d\u1ecbch v\u1ee5 iPad th\u1ebf h\u1ec7 9');brand="Apple Genuine";variant=(U 'D\u1ecbch v\u1ee5 thay th\u1ebf');price=1590000;duration=90;warrantyDays=90;warrantyRemedy="REPLACEMENT"},
    @{type="MacBook";model="MacBook Air M1";issue=$issuePin;code="BAT-MBA-M1-PISEN-A2389";name="Pin MacBook Air M1 A2337";brand="Pisen";variant="A2389";price=2400000;duration=90;warrantyDays=180;warrantyRemedy="REPLACEMENT"},
    @{type="Apple Watch";model="Apple Watch Series 6";issue=$issuePin;code="BAT-AW-S6-APPLE-SVC";name=(U 'Pin d\u1ecbch v\u1ee5 Apple Watch Series 6');brand="Apple Genuine";variant=(U 'D\u1ecbch v\u1ee5 thay th\u1ebf');price=1390000;duration=60;warrantyDays=90;warrantyRemedy="REPLACEMENT"},
    @{type="AirPods";model=(U 'AirPods th\u1ebf h\u1ec7 2');issue=$issuePin;code="SVC-AIRPODS2-APPLE-REPL";name=(U 'B\u1ed9 ph\u1eadn thay th\u1ebf d\u1ecbch v\u1ee5 AirPods th\u1ebf h\u1ec7 2');brand="Apple Genuine";variant=(U 'D\u1ecbch v\u1ee5 thay th\u1ebf');price=1190000;duration=45;warrantyDays=90;warrantyRemedy="REPLACEMENT"}
)

foreach ($definition in $replacementDefinitions) {
    $type = $typeByName[(Key $definition.type)]
    $model = $models | Where-Object { $_.deviceTypeId -eq $type.id -and (Key $_.name) -eq (Key $definition.model) } | Select-Object -First 1
    if ($null -eq $model) { throw "Missing required active model: $($definition.type) / $($definition.model)" }
    $issue = $issueByName[(Key $definition.issue)]
    if ($issue.deviceTypeIds -notcontains $type.id) { throw "Invalid model to issue mapping for $($definition.model) / $($definition.issue)" }
    $part = Ensure-Part $definition
    Ensure-Catalog $model $issue $serviceTypeByCode["REPLACEMENT"] $part $definition $true | Out-Null
    Ensure-DemoInventory $part
}

$coverage = [System.Collections.Generic.List[object]]::new()
foreach ($model in $models) {
    $type = $types | Where-Object id -eq $model.deviceTypeId | Select-Object -First 1
    $mappedIssues = @($issues | Where-Object { $_.deviceTypeIds -contains $type.id })
    $repairableIssues = @($mappedIssues | Where-Object { $repairByType[(Key $type.name)].ContainsKey((Key $_.name)) })
    $missing = @($repairableIssues | Where-Object { -not $catalogByKey.ContainsKey((CatalogKey $model.id $serviceTypeByCode["REPAIR"].id $_.id $null)) } | ForEach-Object name)
    $coverage.Add([ordered]@{ deviceType=$type.name; model=$model.name; applicableIssueCount=$repairableIssues.Count; missingRepairIssues=$missing })
}

$summary = [ordered]@{
    generatedAt = [DateTimeOffset]::Now.ToString("o"); apiBaseUrl = $ApiBaseUrl; actorId = $actorId
    modelsActive = $models.Count; catalogItemsBefore = $catalog.Count; partsBefore = $parts.Count
    partsAdded = @($createdParts); repairCatalogItemsAdded = @($createdRepairCatalog); replacementCatalogItemsAdded = @($createdReplacementCatalog)
    inventoryLotsCreated = @($inventoryLotsCreated); modelCoverage = @($coverage)
    catalogItemsAfter = $catalogByKey.Count; partsAfter = $partByCode.Count
    noBusinessTransactionsCreated = $true
}
$directory = Split-Path -Parent $OutputPath
if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
$summary | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 $OutputPath
$summary | ConvertTo-Json -Depth 12
