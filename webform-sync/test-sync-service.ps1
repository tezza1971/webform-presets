# Webform Sync Service - Comprehensive Test Suite
# Tests all API endpoints with automated validation

param(
    [string]$BaseUrl = "http://localhost:8765/api/v1",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$TestResults = @{
    Passed = 0
    Failed = 0
    Skipped = 0
    Tests = @()
}

# Colors for output
$ColorPass = "Green"
$ColorFail = "Red"
$ColorInfo = "Cyan"
$ColorWarn = "Yellow"

function Write-TestHeader {
    param([string]$Message)
    Write-Host "`n$('='*80)" -ForegroundColor $ColorInfo
    Write-Host $Message -ForegroundColor $ColorInfo
    Write-Host "$('='*80)" -ForegroundColor $ColorInfo
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = "",
        [object]$Response = $null
    )
    
    $result = @{
        Name = $TestName
        Passed = $Passed
        Message = $Message
        Timestamp = Get-Date
    }
    
    $TestResults.Tests += $result
    
    if ($Passed) {
        $TestResults.Passed++
        Write-Host "✓ PASS: $TestName" -ForegroundColor $ColorPass
        if ($Message) { Write-Host "  → $Message" -ForegroundColor Gray }
    } else {
        $TestResults.Failed++
        Write-Host "✗ FAIL: $TestName" -ForegroundColor $ColorFail
        if ($Message) { Write-Host "  → $Message" -ForegroundColor $ColorWarn }
    }
    
    if ($Verbose -and $Response) {
        Write-Host "  Response:" -ForegroundColor Gray
        Write-Host ($Response | ConvertTo-Json -Depth 3) -ForegroundColor DarkGray
    }
}

function Invoke-TestRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    $uri = "$BaseUrl$Endpoint"
    $params = @{
        Uri = $uri
        Method = $Method
        ContentType = "application/json"
        Headers = $Headers
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    
    try {
        $response = Invoke-RestMethod @params
        return @{
            Success = $true
            Data = $response
            StatusCode = 200
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        return @{
            Success = $false
            Error = $_.Exception.Message
            StatusCode = $statusCode
        }
    }
}

# Generate test data
$TestDeviceId = [guid]::NewGuid().ToString()
$TestSessionId = [guid]::NewGuid().ToString()
$TestPresetId = $null

Write-Host "`n╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Webform Sync Service - Automated Test Suite                  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host "Test Device ID: $TestDeviceId" -ForegroundColor Gray
Write-Host "Test Session ID: $TestSessionId" -ForegroundColor Gray

# ============================================================================
# TEST: Health Check
# ============================================================================
Write-TestHeader "Health Check"

$result = Invoke-TestRequest -Method GET -Endpoint "/health"
Write-TestResult -TestName "GET /health" `
    -Passed $result.Success `
    -Message "Service is responding" `
    -Response $result.Data

# ============================================================================
# TEST: Create Preset
# ============================================================================
Write-TestHeader "Preset Creation"

$newPreset = @{
    deviceId = $TestDeviceId
    name = "Test Login Form"
    scopeType = "url"
    scopeValue = "https://test.example.com/login"
    fields = @{
        username = "testuser"
        email = "test@example.com"
    }
    encrypted = $false
}

$result = Invoke-TestRequest -Method POST -Endpoint "/presets" -Body $newPreset
$createSuccess = $result.Success -and $result.Data.data.preset.id
if ($createSuccess) {
    $TestPresetId = $result.Data.data.preset.id
}
Write-TestResult -TestName "POST /presets (create)" `
    -Passed $createSuccess `
    -Message "Preset ID: $TestPresetId" `
    -Response $result.Data

# ============================================================================
# TEST: Get All Presets
# ============================================================================
Write-TestHeader "Preset Retrieval"

$result = Invoke-TestRequest -Method GET -Endpoint "/presets?device_id=$TestDeviceId"
$hasPresets = $result.Success -and $result.Data.data.Count -gt 0
Write-TestResult -TestName "GET /presets (list)" `
    -Passed $hasPresets `
    -Message "Found $($result.Data.data.Count) preset(s)" `
    -Response $result.Data

# ============================================================================
# TEST: Get Specific Preset
# ============================================================================
if ($TestPresetId) {
    $result = Invoke-TestRequest -Method GET -Endpoint "/presets/$TestPresetId`?device_id=$TestDeviceId"
    $getSuccess = $result.Success -and $result.Data.data.id -eq $TestPresetId
    Write-TestResult -TestName "GET /presets/{id}" `
        -Passed $getSuccess `
        -Message "Retrieved preset by ID" `
        -Response $result.Data
} else {
    Write-TestResult -TestName "GET /presets/{id}" `
        -Passed $false `
        -Message "Skipped - no preset ID available"
    $TestResults.Skipped++
}

# ============================================================================
# TEST: Get Presets by Scope
# ============================================================================
Write-TestHeader "Scope-Based Retrieval"

$scopeUrl = [System.Web.HttpUtility]::UrlEncode("https://test.example.com/login")
$result = Invoke-TestRequest -Method GET -Endpoint "/presets/scope/url/$scopeUrl"
$scopeSuccess = $result.Success
Write-TestResult -TestName "GET /presets/scope/{type}/{value}" `
    -Passed $scopeSuccess `
    -Message "Found $($result.Data.data.Count) preset(s) for scope" `
    -Response $result.Data

# ============================================================================
# TEST: Update Preset
# ============================================================================
Write-TestHeader "Preset Update"

if ($TestPresetId) {
    $updateData = @{
        deviceId = $TestDeviceId
        name = "Updated Test Login Form"
        scopeType = "url"
        scopeValue = "https://test.example.com/login"
        fields = @{
            username = "updateduser"
            email = "updated@example.com"
        }
    }
    
    $result = Invoke-TestRequest -Method PUT -Endpoint "/presets/$TestPresetId" -Body $updateData
    $updateSuccess = $result.Success
    Write-TestResult -TestName "PUT /presets/{id}" `
        -Passed $updateSuccess `
        -Message "Preset updated successfully" `
        -Response $result.Data
} else {
    Write-TestResult -TestName "PUT /presets/{id}" `
        -Passed $false `
        -Message "Skipped - no preset ID available"
    $TestResults.Skipped++
}

# ============================================================================
# TEST: Update Preset Usage
# ============================================================================
if ($TestPresetId) {
    $result = Invoke-TestRequest -Method POST -Endpoint "/presets/$TestPresetId/usage"
    $usageSuccess = $result.Success
    Write-TestResult -TestName "POST /presets/{id}/usage" `
        -Passed $usageSuccess `
        -Message "Usage tracked" `
        -Response $result.Data
} else {
    Write-TestResult -TestName "POST /presets/{id}/usage" `
        -Passed $false `
        -Message "Skipped - no preset ID available"
    $TestResults.Skipped++
}

# ============================================================================
# TEST: Disabled Domains
# ============================================================================
Write-TestHeader "Disabled Domains Management"

$testDomain = "blocked.example.com"

# Disable domain
$result = Invoke-TestRequest -Method POST -Endpoint "/disabled-domains/$testDomain`?sessionId=$TestSessionId"
$disableSuccess = $result.Success
Write-TestResult -TestName "POST /disabled-domains/{domain}" `
    -Passed $disableSuccess `
    -Message "Domain disabled" `
    -Response $result.Data

# Check domain status
$result = Invoke-TestRequest -Method GET -Endpoint "/disabled-domains/$testDomain/status?sessionId=$TestSessionId"
$statusSuccess = $result.Success -and $result.Data.data.disabled -eq $true
Write-TestResult -TestName "GET /disabled-domains/{domain}/status" `
    -Passed $statusSuccess `
    -Message "Domain status verified" `
    -Response $result.Data

# List disabled domains
$result = Invoke-TestRequest -Method GET -Endpoint "/disabled-domains?sessionId=$TestSessionId"
$listSuccess = $result.Success -and $result.Data.data.domains -contains $testDomain
Write-TestResult -TestName "GET /disabled-domains (list)" `
    -Passed $listSuccess `
    -Message "Found $($result.Data.data.domains.Count) disabled domain(s)" `
    -Response $result.Data

# Enable domain
$result = Invoke-TestRequest -Method DELETE -Endpoint "/disabled-domains/$testDomain`?sessionId=$TestSessionId"
$enableSuccess = $result.Success
Write-TestResult -TestName "DELETE /disabled-domains/{domain}" `
    -Passed $enableSuccess `
    -Message "Domain enabled" `
    -Response $result.Data

# ============================================================================
# TEST: Devices
# ============================================================================
Write-TestHeader "Device Management"

$result = Invoke-TestRequest -Method GET -Endpoint "/devices"
$devicesSuccess = $result.Success -and $result.Data.data -contains $TestDeviceId
Write-TestResult -TestName "GET /devices" `
    -Passed $devicesSuccess `
    -Message "Found $($result.Data.data.Count) device(s)" `
    -Response $result.Data

# ============================================================================
# TEST: Sync Operations
# ============================================================================
Write-TestHeader "Sync Operations"

# Get sync log for preset
if ($TestPresetId) {
    $result = Invoke-TestRequest -Method GET -Endpoint "/sync/log/$TestPresetId"
    $logSuccess = $result.Success
    Write-TestResult -TestName "GET /sync/log/{id}" `
        -Passed $logSuccess `
        -Message "Retrieved preset sync log" `
        -Response $result.Data
} else {
    Write-TestResult -TestName "GET /sync/log/{id}" `
        -Passed $false `
        -Message "Skipped - no preset ID available"
    $TestResults.Skipped++
}

# Get all sync logs
$result = Invoke-TestRequest -Method GET -Endpoint "/sync/log?limit=10"
$allLogSuccess = $result.Success
Write-TestResult -TestName "GET /sync/log (all)" `
    -Passed $allLogSuccess `
    -Message "Retrieved $($result.Data.data.Count) sync log entries" `
    -Response $result.Data

# Get sync status
$result = Invoke-TestRequest -Method GET -Endpoint "/sync/status?device_id=$TestDeviceId"
$statusSuccess = $result.Success
Write-TestResult -TestName "GET /sync/status" `
    -Passed $statusSuccess `
    -Message "Sync status retrieved" `
    -Response $result.Data

# ============================================================================
# TEST: Delete Preset (Cleanup)
# ============================================================================
Write-TestHeader "Cleanup"

if ($TestPresetId) {
    $result = Invoke-TestRequest -Method DELETE -Endpoint "/presets/$TestPresetId`?device_id=$TestDeviceId"
    $deleteSuccess = $result.Success
    Write-TestResult -TestName "DELETE /presets/{id}" `
        -Passed $deleteSuccess `
        -Message "Test preset deleted" `
        -Response $result.Data
} else {
    Write-TestResult -TestName "DELETE /presets/{id}" `
        -Passed $false `
        -Message "Skipped - no preset ID available"
    $TestResults.Skipped++
}

# ============================================================================
# TEST SUMMARY
# ============================================================================
Write-Host "`n╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                         TEST SUMMARY                                  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$total = $TestResults.Passed + $TestResults.Failed + $TestResults.Skipped
$passRate = if ($total -gt 0) { [math]::Round(($TestResults.Passed / $total) * 100, 1) } else { 0 }

Write-Host "`nTotal Tests: $total" -ForegroundColor Gray
Write-Host "  Passed:  $($TestResults.Passed)" -ForegroundColor $ColorPass
Write-Host "  Failed:  $($TestResults.Failed)" -ForegroundColor $ColorFail
Write-Host "  Skipped: $($TestResults.Skipped)" -ForegroundColor $ColorWarn
Write-Host "`nPass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 90) { $ColorPass } elseif ($passRate -ge 70) { $ColorWarn } else { $ColorFail })

if ($TestResults.Failed -gt 0) {
    Write-Host "`nFailed Tests:" -ForegroundColor $ColorFail
    $TestResults.Tests | Where-Object { -not $_.Passed } | ForEach-Object {
        Write-Host "  • $($_.Name): $($_.Message)" -ForegroundColor $ColorWarn
    }
}

Write-Host "`n" -NoNewline

# Exit with appropriate code
exit $TestResults.Failed
