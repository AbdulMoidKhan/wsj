# Workspace Junction - Image Optimization Setup Script
# Run this script to install dependencies and optimize images

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Workspace Junction" -ForegroundColor Cyan
Write-Host "  Image Optimization Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "📁 Project: $projectRoot" -ForegroundColor Green
Write-Host ""

# Step 1: Check if Node.js is installed
Write-Host "[1/4] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js $nodeVersion installed" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Step 2: Install dependencies
Write-Host ""
Write-Host "[2/4] Installing image optimization dependencies..." -ForegroundColor Yellow
Write-Host "  Installing: sharp, @aws-sdk/client-s3, svgo" -ForegroundColor Gray

try {
    npm install --save-dev sharp @aws-sdk/client-s3 svgo
    Write-Host "  ✅ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Some dependencies may already be installed" -ForegroundColor Yellow
}

# Step 3: Verify R2 credentials
Write-Host ""
Write-Host "[3/4] Verifying R2 credentials..." -ForegroundColor Yellow

$envPath = Join-Path $projectRoot "backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    $hasR2Config = $envContent -match "R2_BUCKET_NAME" -and 
                   $envContent -match "R2_ACCESS_KEY_ID" -and 
                   $envContent -match "R2_SECRET_ACCESS_KEY"
    
    if ($hasR2Config) {
        Write-Host "  ✅ R2 credentials found in backend/.env" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  R2 credentials incomplete in backend/.env" -ForegroundColor Yellow
        Write-Host "  Please ensure these variables exist:" -ForegroundColor Gray
        Write-Host "    - R2_ACCOUNT_ID" -ForegroundColor Gray
        Write-Host "    - R2_ACCESS_KEY_ID" -ForegroundColor Gray
        Write-Host "    - R2_SECRET_ACCESS_KEY" -ForegroundColor Gray
        Write-Host "    - R2_BUCKET_NAME" -ForegroundColor Gray
        Write-Host "    - R2_ENDPOINT" -ForegroundColor Gray
    }
} else {
    Write-Host "  ❌ backend/.env not found" -ForegroundColor Red
    exit 1
}

# Step 4: Run optimization
Write-Host ""
Write-Host "[4/4] Starting image optimization..." -ForegroundColor Yellow
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  This may take 10-20 minutes" -ForegroundColor Cyan
Write-Host "  Processing 603 images..." -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "Start optimization now? (Y/n)"
if ($confirm -eq "" -or $confirm -eq "Y" -or $confirm -eq "y") {
    try {
        node scripts/optimize-and-upload-images.mjs
        
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host "  ✅ OPTIMIZATION COMPLETE" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "📄 Check the report:" -ForegroundColor Cyan
        Write-Host "   scripts/output/optimization-report.json" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📋 Next steps:" -ForegroundColor Cyan
        Write-Host "   1. Review optimization report" -ForegroundColor Gray
        Write-Host "   2. Check scripts/output/duplicates.txt" -ForegroundColor Gray
        Write-Host "   3. Test pages with optimized images" -ForegroundColor Gray
        Write-Host "   4. Deploy to production" -ForegroundColor Gray
        Write-Host ""
        
    } catch {
        Write-Host ""
        Write-Host "❌ Optimization failed: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "  1. Ensure all dependencies installed correctly" -ForegroundColor Gray
        Write-Host "  2. Verify R2 credentials in backend/.env" -ForegroundColor Gray
        Write-Host "  3. Check error logs above" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "⏭️  Optimization skipped." -ForegroundColor Yellow
    Write-Host "   Run manually with: node scripts/optimize-and-upload-images.mjs" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
