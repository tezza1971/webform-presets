# Build Script for Webform Sync Service
# PowerShell script for Windows

param(
    [string]$Target = "current",
    [string]$Output = ".\build",
    [switch]$Clean,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$BinaryName = "webform-sync"
$Version = "v1.0.0"

function Show-Help {
    Write-Host "Webform Sync Service - Build Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\build.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Target <platform>   Target platform: current, all, windows, linux, macos" -ForegroundColor Gray
    Write-Host "  -Output <path>       Output directory (default: .\build)" -ForegroundColor Gray
    Write-Host "  -Clean               Clean build artifacts before building" -ForegroundColor Gray
    Write-Host "  -Help                Show this help message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\build.ps1                          # Build for current platform" -ForegroundColor Gray
    Write-Host "  .\build.ps1 -Target all              # Build for all platforms" -ForegroundColor Gray
    Write-Host "  .\build.ps1 -Target windows -Clean   # Clean build for Windows" -ForegroundColor Gray
}

function Test-GoInstalled {
    try {
        $null = Get-Command go -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Install-Dependencies {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    go mod download
    go mod tidy
    Write-Host "Dependencies installed!" -ForegroundColor Green
}

function Clean-Artifacts {
    Write-Host "Cleaning build artifacts..." -ForegroundColor Cyan
    if (Test-Path $Output) {
        Remove-Item -Path $Output -Recurse -Force
    }
    if (Test-Path ".\data\*.db") {
        Remove-Item -Path ".\data\*.db" -Force
    }
    if (Test-Path ".\logs\*.log") {
        Remove-Item -Path ".\logs\*.log" -Force
    }
    Write-Host "Clean complete!" -ForegroundColor Green
}

function Build-Current {
    Write-Host "Building for current platform..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $Output | Out-Null
    
    $env:CGO_ENABLED = "1"
    go build -trimpath -o "$Output\$BinaryName.exe" .\cmd\webform-sync
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build successful: $Output\$BinaryName.exe" -ForegroundColor Green
    }
    else {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
}

function Build-Windows {
    Write-Host "Building for Windows amd64..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $Output | Out-Null
    
    $env:CGO_ENABLED = "1"
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    
    go build -trimpath -o "$Output\$BinaryName-windows-amd64.exe" .\cmd\webform-sync
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build successful: $Output\$BinaryName-windows-amd64.exe" -ForegroundColor Green
    }
    else {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
}

function Build-Linux {
    Write-Host "Building for Linux..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $Output | Out-Null
    
    # Linux amd64
    Write-Host "  - Linux amd64..." -ForegroundColor Gray
    $env:CGO_ENABLED = "1"
    $env:GOOS = "linux"
    $env:GOARCH = "amd64"
    go build -trimpath -o "$Output\$BinaryName-linux-amd64" .\cmd\webform-sync
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Linux amd64 build failed!" -ForegroundColor Red
        exit 1
    }
    
    # Linux arm64 (requires cross-compiler)
    Write-Host "  - Linux arm64..." -ForegroundColor Gray
    $env:GOARCH = "arm64"
    go build -trimpath -o "$Output\$BinaryName-linux-arm64" .\cmd\webform-sync
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Linux arm64 build failed (cross-compiler may be needed)" -ForegroundColor Yellow
    }
    
    Write-Host "Linux builds complete!" -ForegroundColor Green
}

function Build-MacOS {
    Write-Host "Building for macOS..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $Output | Out-Null
    
    # macOS amd64
    Write-Host "  - macOS amd64 (Intel)..." -ForegroundColor Gray
    $env:CGO_ENABLED = "1"
    $env:GOOS = "darwin"
    $env:GOARCH = "amd64"
    go build -trimpath -o "$Output\$BinaryName-darwin-amd64" .\cmd\webform-sync
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "macOS amd64 build failed (macOS SDK may be needed)" -ForegroundColor Yellow
    }
    
    # macOS arm64
    Write-Host "  - macOS arm64 (Apple Silicon)..." -ForegroundColor Gray
    $env:GOARCH = "arm64"
    go build -trimpath -o "$Output\$BinaryName-darwin-arm64" .\cmd\webform-sync
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "macOS arm64 build failed (macOS SDK may be needed)" -ForegroundColor Yellow
    }
    
    Write-Host "macOS builds complete!" -ForegroundColor Green
}

function Build-All {
    Write-Host "Building for all platforms..." -ForegroundColor Cyan
    Build-Windows
    Build-Linux
    Build-MacOS
    Write-Host ""
    Write-Host "All builds complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Build artifacts:" -ForegroundColor Cyan
    Get-ChildItem -Path $Output | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  $($_.Name) - $size MB" -ForegroundColor Gray
    }
}

# Main execution
if ($Help) {
    Show-Help
    exit 0
}

if (-not (Test-GoInstalled)) {
    Write-Host "Error: Go is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Go from https://go.dev/dl/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Webform Sync Service - Build $Version" -ForegroundColor Cyan
Write-Host ""

if ($Clean) {
    Clean-Artifacts
}

Install-Dependencies

switch ($Target.ToLower()) {
    "current" { Build-Current }
    "all" { Build-All }
    "windows" { Build-Windows }
    "linux" { Build-Linux }
    "macos" { Build-MacOS }
    default {
        Write-Host "Error: Unknown target '$Target'" -ForegroundColor Red
        Write-Host "Valid targets: current, all, windows, linux, macos" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
