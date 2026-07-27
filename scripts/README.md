# Deployment Scripts

These scripts deploy TopList from Windows 11 using PowerShell and the built-in OpenSSH tools (`ssh` and `scp`).

They are intended for a cPanel-style server where:

- the backend is a Django app restarted from cPanel or Passenger,
- the main frontend is served from one static directory,
- the demo frontend is served from a second static directory,
- the backend has a single codebase but runs as two separate apps (main
  and demo) in two directories, each with its own database,
- the production databases live only on the server and must not be overwritten.

## Prerequisites

On Windows 11, confirm these commands work in PowerShell:

```powershell
ssh -V
where.exe scp
tar --version
```

Node dependencies should already be installed locally:

```powershell
cd C:\prog\toplista\frontend
npm install
```

## SSH Setup

Prefer configuring the server in your user SSH config instead of putting host/user/port/key details in this repo.

Create or edit:

```text
C:\Users\<you>\.ssh\config
```

Example:

```ssh-config
Host toplista
    HostName example.com
    User cpanel_user
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
```

Test it:

```powershell
ssh toplista "pwd"
```

## Local Deploy Config

Copy the example config:

```powershell
cd C:\prog\toplista
Copy-Item scripts\deploy.config.example.ps1 scripts\deploy.config.ps1
```

Edit `scripts\deploy.config.ps1` and fill in your real server paths.

Do not commit `scripts\deploy.config.ps1`. It is ignored by git because it contains machine-specific paths and commands.

Required values:

- `$SshHost` - SSH config alias, usually `toplista`
- `$RemoteFrontendMainPath` - remote folder for `https://.../toplista/`
- `$RemoteFrontendDemoPath` - remote folder for `https://.../toplista-demo/`
- `$RemoteBackendMainPath` - remote Django backend folder for the main app
- `$RemoteBackendDemoPath` - remote Django backend folder for the demo app
- `$RemoteTempPath` - writable remote folder for temporary `.tar.gz` uploads
- `$RemotePythonMain` / `$RemotePythonDemo` - server-side Python executables, preferably the cPanel virtualenv Python of each app
- `$RemoteRestartCommandMain` / `$RemoteRestartCommandDemo` - optional commands to restart each Python app

If you do not know a restart command yet, leave it as `""`. The script will upload the backend and remind you to restart that app manually in cPanel.

## Usage

Run commands from the repo root:

```powershell
cd C:\prog\toplista
```

Deploy both frontends and backend:

```powershell
.\scripts\deploy.ps1 -Target all
```

Deploy only the main frontend:

```powershell
.\scripts\deploy.ps1 -Target frontend-main
```

Deploy only the demo frontend:

```powershell
.\scripts\deploy.ps1 -Target frontend-demo
```

Deploy both frontends:

```powershell
.\scripts\deploy.ps1 -Target frontend
```

Deploy the backend to both apps (main and demo):

```powershell
.\scripts\deploy.ps1 -Target backend
```

Deploy the backend to only one app:

```powershell
.\scripts\deploy.ps1 -Target backend-main
.\scripts\deploy.ps1 -Target backend-demo
```

Preview commands without running them:

```powershell
.\scripts\deploy.ps1 -Target all -DryRun
```

## What The Script Does

For the main frontend:

1. Runs `npm run build`.
2. Archives `frontend\build`.
3. Uploads the archive over `scp`.
4. Extracts it into `$RemoteFrontendMainPath`.

For the demo frontend:

1. Runs `npm run build:demo`.
2. Archives `frontend\build`.
3. Uploads the archive over `scp`.
4. Extracts it into `$RemoteFrontendDemoPath`.

For the backend:

1. Creates a single backend archive containing only:
   - `backend\api`
   - `backend\toplista`
   - `backend\manage.py`
   - `backend\requirements.txt` if present
2. Then, for each selected app (main and/or demo):
   - Uploads the archive over `scp`.
   - Extracts it into `$RemoteBackendMainPath` or `$RemoteBackendDemoPath`.
   - Optionally installs requirements with that app's Python.
   - Optionally runs migrations against that app's database.
   - Runs that app's restart command, or reminds you to restart manually.

There is one backend codebase; the main and demo apps are separate deployments of the same build.

The backend archive intentionally does not include `db.sqlite3`, `.venv`, `__pycache__`, or local settings files.

## Useful Flags

Skip frontend build and upload the existing `frontend\build` folder:

```powershell
.\scripts\deploy.ps1 -Target frontend-main -SkipBuild
```

Clean frontend directory before extracting the new build:

```powershell
.\scripts\deploy.ps1 -Target frontend -CleanFrontend
```

`-CleanFrontend` preserves `.htaccess` but removes other files in the target directory first. Use it when old hashed static files are piling up or when removed files keep being served.

Install backend dependencies after upload:

```powershell
.\scripts\deploy.ps1 -Target backend -InstallRequirements
```

Run Django migrations after upload:

```powershell
.\scripts\deploy.ps1 -Target backend -RunMigrations
```

Upload backend without restarting:

```powershell
.\scripts\deploy.ps1 -Target backend -SkipRestart
```

## Recommended Deploys

Frontend-only change:

```powershell
.\scripts\deploy.ps1 -Target frontend
```

Backend code-only change:

```powershell
.\scripts\deploy.ps1 -Target backend
```

Backend change with migrations:

```powershell
.\scripts\deploy.ps1 -Target backend -RunMigrations
```

Full release:

```powershell
.\scripts\deploy.ps1 -Target all
```

## Backend Secret Keys

Each deployed backend app should have its own Django `SECRET_KEY`, stored in `secret_key.txt` next to `manage.py` on the server (or in a `DJANGO_SECRET_KEY` environment variable). Distinct keys ensure JWTs issued by one app are not valid on the other.

Generate one per app, over SSH:

```powershell
ssh toplista "python3 -c 'import secrets; print(secrets.token_urlsafe(64))' > /path/to/backend/secret_key.txt && chmod 600 /path/to/backend/secret_key.txt"
```

The deploy script never uploads or overwrites `secret_key.txt` (the backend archive contains only `api`, `toplista`, `manage.py` and `requirements.txt`). Restart the app after creating the file. Changing the key logs everyone out but does not affect the database or user passwords.

## Notes And Safety

- Keep SSH keys in `C:\Users\<you>\.ssh\`, not in this repo.
- Keep `scripts\deploy.config.ps1` local and uncommitted.
- Do not upload or overwrite the production `db.sqlite3`.
- If you run migrations on SQLite, prefer a quiet moment or stop the app first in cPanel.
- If a restart command (`$RemoteRestartCommandMain` / `$RemoteRestartCommandDemo`) is empty, restart that backend app manually in cPanel after backend deploys.
