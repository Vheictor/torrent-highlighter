$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ManifestPath = Join-Path $RepoRoot 'manifest.json'

if (-not (Test-Path $ManifestPath)) {
  throw "manifest.json not found in $RepoRoot"
}

$ManifestRaw = [System.IO.File]::ReadAllText($ManifestPath, [System.Text.Encoding]::UTF8)
$ManifestData = $ManifestRaw | ConvertFrom-Json
$Version = [string]$ManifestData.version

if ([string]::IsNullOrWhiteSpace($Version)) {
  throw 'Missing version field in manifest.json'
}

$DistRoot = Join-Path $RepoRoot 'dist'
$ChromiumDir = Join-Path $DistRoot 'chromium'
$FirefoxDir = Join-Path $DistRoot 'firefox'

foreach ($TargetDir in @($ChromiumDir, $FirefoxDir)) {
  if (Test-Path $TargetDir) {
    Remove-Item -Path $TargetDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$RuntimeFiles = @(
  'manifest.json',
  'defaults.js',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'LICENSE'
)

$IconsSource = Join-Path $RepoRoot 'assets\icons'

function Copy-RuntimeAssets {
  param([string]$DestinationDir)

  foreach ($RelFile in $RuntimeFiles) {
    $Src = Join-Path $RepoRoot $RelFile
    if (-not (Test-Path $Src)) {
      throw "Missing runtime file: $RelFile"
    }
    Copy-Item -Path $Src -Destination (Join-Path $DestinationDir $RelFile) -Force
  }

  $IconsDest = Join-Path $DestinationDir 'assets\icons'
  New-Item -ItemType Directory -Path $IconsDest -Force | Out-Null
  Get-ChildItem -Path $IconsSource -File | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $IconsDest $_.Name) -Force
  }
}

Copy-RuntimeAssets -DestinationDir $ChromiumDir
Copy-RuntimeAssets -DestinationDir $FirefoxDir

# Firefox MV3 uses Event Pages (background.scripts) and requires gecko.id + strict_min_version 121.0
$FirefoxManifest = $ManifestRaw | ConvertFrom-Json
$FirefoxManifest.background = [ordered]@{
  scripts = @('defaults.js', 'background.js')
}
$FirefoxManifest | Add-Member -MemberType NoteProperty -Name 'browser_specific_settings' -Value ([ordered]@{
  gecko = [ordered]@{
    id = 'torrent-highlighter@vheictor.github.io'
    strict_min_version = '121.0'
  }
}) -Force

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$FirefoxManifestJson = ($FirefoxManifest | ConvertTo-Json -Depth 10) + "`n"
[System.IO.File]::WriteAllText((Join-Path $FirefoxDir 'manifest.json'), $FirefoxManifestJson, $Utf8NoBom)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function New-PosixZipArchive {
  param(
    [string]$SourceDir,
    [string]$ZipPath
  )

  if (Test-Path $ZipPath) {
    Remove-Item -Path $ZipPath -Force
  }

  $BaseLen = $SourceDir.TrimEnd('\', '/').Length + 1
  $Zip = [System.IO.Compression.ZipFile]::Open($ZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem -Path $SourceDir -Recurse -File | ForEach-Object {
      $EntryName = $_.FullName.Substring($BaseLen).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $Zip,
        $_.FullName,
        $EntryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  } finally {
    $Zip.Dispose()
  }
}

$ChromiumZip = Join-Path $DistRoot "torrent-highlighter-v$Version-chromium.zip"
$FirefoxZip = Join-Path $DistRoot "torrent-highlighter-v$Version-firefox.zip"

New-PosixZipArchive -SourceDir $ChromiumDir -ZipPath $ChromiumZip
New-PosixZipArchive -SourceDir $FirefoxDir -ZipPath $FirefoxZip

Write-Output "Build v$Version complete:"
Write-Output " - $ChromiumZip"
Write-Output " - $FirefoxZip"
