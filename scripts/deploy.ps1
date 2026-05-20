[CmdletBinding()]
param(
  [ValidateSet("frontend-main", "frontend-demo", "frontend", "backend-main", "backend-demo", "backend", "all")]
  [string]$Target = "all",

  [switch]$SkipBuild,
  [switch]$CleanFrontend,
  [switch]$InstallRequirements,
  [switch]$RunMigrations,
  [switch]$SkipRestart,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir "deploy.config.ps1"
$TempRoot = Join-Path $RepoRoot ".deploy"

if (-not (Test-Path $ConfigPath)) {
  throw "Missing $ConfigPath. Copy scripts/deploy.config.example.ps1 to scripts/deploy.config.ps1 and fill it in."
}

. $ConfigPath

foreach ($requiredName in @("SshHost", "RemoteFrontendMainPath", "RemoteFrontendDemoPath", "RemoteBackendMainPath", "RemoteBackendDemoPath", "RemoteTempPath")) {
  if (-not (Get-Variable -Name $requiredName -ValueOnly -ErrorAction SilentlyContinue)) {
    throw "Missing required deploy config value: `$$requiredName"
  }
}

function Invoke-Local {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [string]$WorkingDirectory = $RepoRoot
  )

  $command = "$FilePath $($ArgumentList -join ' ')".Trim()
  Write-Host "> $command" -ForegroundColor Cyan

  if ($DryRun) {
    return
  }

  Push-Location $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $command"
    }
  }
  finally {
    Pop-Location
  }
}

function Invoke-Remote {
  param([Parameter(Mandatory = $true)][string]$Command)

  Invoke-Local -FilePath "ssh" -ArgumentList @($SshHost, $Command)
}

function Copy-ToRemote {
  param(
    [Parameter(Mandatory = $true)][string]$LocalPath,
    [Parameter(Mandatory = $true)][string]$RemotePath
  )

  Invoke-Local -FilePath "scp" -ArgumentList @($LocalPath, "${SshHost}:$RemotePath")
}

function ConvertTo-RemoteQuote {
  param([Parameter(Mandatory = $true)][string]$Value)

  if ($Value.Contains("'")) {
    throw "Remote values containing single quotes are not supported by this script: $Value"
  }

  return "'$Value'"
}

function New-ArchiveFromDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDirectory,
    [Parameter(Mandatory = $true)][string]$ArchivePath
  )

  if (-not $DryRun -and (Test-Path $ArchivePath)) {
    Remove-Item -Force $ArchivePath
  }

  Invoke-Local -FilePath "tar" -ArgumentList @("-czf", $ArchivePath, "-C", $SourceDirectory, ".")
}

function Publish-Archive {
  param(
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$RemoteDeployPath,
    [switch]$CleanBeforeExtract
  )

  $archiveName = Split-Path -Leaf $ArchivePath
  $remoteArchivePath = "$RemoteTempPath/$archiveName"

  Invoke-Remote "mkdir -p $(ConvertTo-RemoteQuote $RemoteTempPath) $(ConvertTo-RemoteQuote $RemoteDeployPath)"
  Copy-ToRemote -LocalPath $ArchivePath -RemotePath $remoteArchivePath

  if ($CleanBeforeExtract) {
    Invoke-Remote "find $(ConvertTo-RemoteQuote $RemoteDeployPath) -mindepth 1 ! -name '.htaccess' -exec rm -rf {} +"
  }

  Invoke-Remote "tar -xzf $(ConvertTo-RemoteQuote $remoteArchivePath) -C $(ConvertTo-RemoteQuote $RemoteDeployPath) && rm -f $(ConvertTo-RemoteQuote $remoteArchivePath)"
}

function Invoke-FrontendBuild {
  param([Parameter(Mandatory = $true)][ValidateSet("main", "demo")][string]$Mode)

  if ($SkipBuild) {
    Write-Host "Skipping frontend build for $Mode." -ForegroundColor Yellow
    return
  }

  $scriptName = if ($Mode -eq "main") { "build" } else { "build:demo" }
  Invoke-Local -FilePath "npm" -ArgumentList @("run", $scriptName) -WorkingDirectory (Join-Path $RepoRoot "frontend")
}

function Publish-Frontend {
  param([Parameter(Mandatory = $true)][ValidateSet("main", "demo")][string]$Mode)

  Invoke-FrontendBuild -Mode $Mode

  $buildDir = Join-Path $RepoRoot "frontend\build"
  if (-not $DryRun) {
    if (-not (Test-Path $buildDir)) {
      throw "Frontend build output not found: $buildDir"
    }

    if (-not (Test-Path $TempRoot)) {
      New-Item -ItemType Directory -Path $TempRoot | Out-Null
    }
  }

  $archivePath = Join-Path $TempRoot "toplista-frontend-$Mode.tar.gz"
  New-ArchiveFromDirectory -SourceDirectory $buildDir -ArchivePath $archivePath

  $remotePath = if ($Mode -eq "main") { $RemoteFrontendMainPath } else { $RemoteFrontendDemoPath }
  Publish-Archive -ArchivePath $archivePath -RemoteDeployPath $remotePath -CleanBeforeExtract:$CleanFrontend
}

function New-BackendArchive {
  $staging = Join-Path $TempRoot "backend-staging"
  $archivePath = Join-Path $TempRoot "toplista-backend.tar.gz"

  if ($DryRun) {
    Write-Host "> stage backend files (api, toplista, manage.py, requirements.txt; excluding __pycache__) to $staging" -ForegroundColor Cyan
    New-ArchiveFromDirectory -SourceDirectory $staging -ArchivePath $archivePath
    return $archivePath
  }

  if (-not (Test-Path $TempRoot)) {
    New-Item -ItemType Directory -Path $TempRoot | Out-Null
  }

  if (Test-Path $staging) {
    Remove-Item -Recurse -Force $staging
  }
  New-Item -ItemType Directory -Path $staging | Out-Null

  foreach ($entry in @("api", "toplista")) {
    Copy-Item -Recurse -Path (Join-Path $RepoRoot "backend\$entry") -Destination (Join-Path $staging $entry)
  }

  Copy-Item -Path (Join-Path $RepoRoot "backend\manage.py") -Destination $staging

  $requirementsPath = Join-Path $RepoRoot "backend\requirements.txt"
  if (Test-Path $requirementsPath) {
    Copy-Item -Path $requirementsPath -Destination $staging
  }

  # The archive must not include local Python bytecode (see scripts/README.md).
  Get-ChildItem -Path $staging -Recurse -Directory -Filter "__pycache__" |
    Remove-Item -Recurse -Force

  New-ArchiveFromDirectory -SourceDirectory $staging -ArchivePath $archivePath
  return $archivePath
}

function Publish-BackendInstance {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("main", "demo")][string]$Mode,
    [Parameter(Mandatory = $true)][string]$ArchivePath
  )

  $remotePath = if ($Mode -eq "main") { $RemoteBackendMainPath } else { $RemoteBackendDemoPath }
  $remotePython = if ($Mode -eq "main") { $RemotePythonMain } else { $RemotePythonDemo }
  if (-not $remotePython) {
    $remotePython = "python3"
  }
  $restartCommand = if ($Mode -eq "main") { $RemoteRestartCommandMain } else { $RemoteRestartCommandDemo }

  Write-Host "Deploying backend ($Mode) to $remotePath" -ForegroundColor Cyan
  Publish-Archive -ArchivePath $ArchivePath -RemoteDeployPath $remotePath

  if ($InstallRequirements) {
    Invoke-Remote "cd $(ConvertTo-RemoteQuote $remotePath) && if [ -f requirements.txt ]; then $(ConvertTo-RemoteQuote $remotePython) -m pip install -r requirements.txt; else echo 'No requirements.txt found; skipping dependency install.'; fi"
  }

  if ($RunMigrations) {
    Invoke-Remote "cd $(ConvertTo-RemoteQuote $remotePath) && $(ConvertTo-RemoteQuote $remotePython) manage.py migrate --noinput"
  }

  if (-not $SkipRestart) {
    if ($restartCommand) {
      Invoke-Remote $restartCommand
    }
    else {
      Write-Host "No restart command configured for the $Mode backend; restart the Python app manually in cPanel." -ForegroundColor Yellow
    }
  }
}

function Publish-Backend {
  param([Parameter(Mandatory = $true)][string[]]$Modes)

  # There is a single backend codebase: build the archive once, then
  # publish it to each backend app directory on the server.
  $archivePath = New-BackendArchive
  foreach ($mode in $Modes) {
    Publish-BackendInstance -Mode $mode -ArchivePath $archivePath
  }
}

switch ($Target) {
  "frontend-main" { Publish-Frontend -Mode "main" }
  "frontend-demo" { Publish-Frontend -Mode "demo" }
  "frontend" {
    Publish-Frontend -Mode "main"
    Publish-Frontend -Mode "demo"
  }
  "backend-main" { Publish-Backend -Modes @("main") }
  "backend-demo" { Publish-Backend -Modes @("demo") }
  "backend" { Publish-Backend -Modes @("main", "demo") }
  "all" {
    Publish-Frontend -Mode "main"
    Publish-Frontend -Mode "demo"
    Publish-Backend -Modes @("main", "demo")
  }
}

Write-Host "Deploy target '$Target' completed." -ForegroundColor Green
