# Copy this file to deploy.config.ps1 and fill in values for your server.
# deploy.config.ps1 is gitignored; do not commit server paths or secrets.

[Diagnostics.CodeAnalysis.SuppressMessageAttribute(
  "PSUseDeclaredVarsMoreThanAssignments",
  "",
  Justification = "Example config values are dot-sourced by deploy.ps1."
)]
param()

# Prefer an alias from ~/.ssh/config, e.g.:
# Host toplista
#   HostName example.com
#   User cpanel_user
#   Port 2222
#   IdentityFile ~/.ssh/id_ed25519
$SshHost = "toplista"

# Remote paths on your cPanel account.
# The backend has a single codebase but is deployed twice: the main and
# demo apps run separate copies (with separate databases) on the server.
$RemoteFrontendMainPath = "/home/USER/public_html/toplista"
$RemoteFrontendDemoPath = "/home/USER/public_html/toplista-demo"
$RemoteBackendMainPath = "/home/USER/path/to/backend"
$RemoteBackendDemoPath = "/home/USER/path/to/backend-demo"

# Directory where temporary archives can be uploaded.
$RemoteTempPath = "/home/USER/tmp"

# Python executables on the server, per backend app. These may be the
# cPanel virtualenv pythons, which usually differ between the two apps.
# Example: "/home/USER/virtualenv/toplista/3.11/bin/python"
$RemotePythonMain = "python3"
$RemotePythonDemo = "python3"

# Commands that restart each backend app. Common Passenger patterns include:
# $RemoteRestartCommandMain = "touch /home/USER/path/to/backend/passenger_wsgi.py"
# or:
# $RemoteRestartCommandMain = "mkdir -p /home/USER/path/to/backend/tmp && touch /home/USER/path/to/backend/tmp/restart.txt"
$RemoteRestartCommandMain = ""
$RemoteRestartCommandDemo = ""
