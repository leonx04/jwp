# Máy ảo Android nhẹ cho JWP (Windows / PowerShell).
#   .\scripts\emulator.ps1           tạo máy ảo JWP_Lite nếu chưa có, rồi bật nó
#   .\scripts\emulator.ps1 -Wipe     bật lại từ đầu (xoá dữ liệu trong máy ảo)
# Cần Android SDK (biến ANDROID_HOME hoặc thư mục mặc định của Android Studio).
param([switch]$Wipe)
$ErrorActionPreference = 'Stop'

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$emulator = Join-Path $sdk 'emulator\emulator.exe'
$sdkmanager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
$avdmanager = Join-Path $sdk 'cmdline-tools\latest\bin\avdmanager.bat'
$name = 'JWP_Lite'
# Android 14, x86_64, có Google APIs (cần cho thông báo và ML Kit), không có Play Store cho nhẹ
$image = 'system-images;android-34;google_apis;x86_64'

if (-not (Test-Path $emulator)) { throw "Không thấy emulator ở $emulator. Cài 'Android Emulator' trong SDK Manager." }

$avdDir = Join-Path $env:USERPROFILE ".android\avd\$name.avd"
if (-not (Test-Path $avdDir)) {
  if (-not (Test-Path $sdkmanager)) { throw "Không thấy sdkmanager. Cài 'Android SDK Command-line Tools (latest)' trong SDK Manager." }
  Write-Host "Tải system image $image (một lần, khoảng 1,5 GB)..."
  & $sdkmanager --install $image
  Write-Host "Tạo máy ảo $name..."
  'no' | & $avdmanager create avd -n $name -k $image -d pixel_6 --force
  $config = Join-Path $avdDir 'config.ini'
  $tweaks = @{
    'hw.ramSize' = '2048'
    'vm.heapSize' = '256'
    'hw.gpu.enabled' = 'yes'
    'hw.gpu.mode' = 'host'
    'hw.keyboard' = 'yes'
    'hw.audioInput' = 'no'
    'hw.audioOutput' = 'no'
    'hw.camera.back' = 'virtualscene'
    'disk.dataPartition.size' = '6G'
    'fastboot.forceColdBoot' = 'no'
  }
  $lines = Get-Content $config | Where-Object { $tweaks.Keys -notcontains ($_ -split '=')[0].Trim() }
  $lines += $tweaks.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
  Set-Content -Path $config -Value $lines -Encoding ascii
}

$emuArgs = @('-avd', $name, '-no-boot-anim', '-no-audio', '-gpu', 'host', '-memory', '2048', '-cores', '2')
if ($Wipe) { $emuArgs += '-wipe-data' }
Write-Host "Bật $name. Lần sau mở sẽ nhanh vì máy ảo lưu trạng thái (quick boot)."
Start-Process -FilePath $emulator -ArgumentList $emuArgs
