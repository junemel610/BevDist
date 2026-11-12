# BevDist deployment on a Windows 11 Surface

This setup runs the browser app, Express API, and PostgreSQL on the same Surface. It binds the API to `127.0.0.1`, so other Wi-Fi devices cannot connect to it. The Windows machine only needs Node.js and PostgreSQL; Expo is used on the development Mac to build the web files.

## 1. Build the web app on the Mac

From the project folder:

```bash
cd mobileFrontend
EXPO_PUBLIC_API_URL=http://127.0.0.1:5000 npx expo export --platform web
```

Copy the generated `mobileFrontend/dist` folder to the same location in the repository on the Surface. Do not commit `dist`; it is ignored by Git. This web bundle points to the API on the Surface itself.

## 2. Prepare the Surface

1. Install Node.js LTS and PostgreSQL 15. Keep the PostgreSQL administrator password available during setup.
2. Clone the private repository to a stable folder, for example `C:\BevDist`.
3. Copy the web build into `C:\BevDist\mobileFrontend\dist`.
4. Open PowerShell in the repository folder and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\ops\setup-server.ps1
```

The script locates folders relative to itself, creates the `bevdist_app` database role and `bevdist_db` database if they do not exist, writes `mobileBackend\.env` with a generated JWT secret, installs backend dependencies, checks the DB connection, and runs migrations. It does not overwrite an existing `.env`, database, or database owner. If you already have a database with a different owner, stop and review it in pgAdmin before continuing.

When prompted, provide the PostgreSQL administrator password and set a strong database-role password. The POS user password is created separately in step 3.

## 3. Create the POS login and start the server

From the same repository folder:

```powershell
Set-Location .\mobileBackend
npm run user:create -- junemel
Set-Location ..
.\ops\manage-server.ps1 -Action start
```

Open **http://127.0.0.1:5000** on the Surface and sign in. The API health check is **http://127.0.0.1:5000/health**.

Useful server commands, from the repository folder:

```powershell
.\ops\manage-server.ps1 -Action status
.\ops\manage-server.ps1 -Action restart
.\ops\manage-server.ps1 -Action stop
```

To start the API automatically whenever the Surface user signs in:

```powershell
.\ops\manage-server.ps1 -Action install-startup
```

The manager writes logs to `%LOCALAPPDATA%\BevDist\logs`. Keep the Surface plugged in and configure Windows power settings so it does not sleep during business hours.

## 4. Back up and restore

Create a local custom-format backup:

```powershell
.\ops\backup-cloud.ps1
```

Backups go to `%LOCALAPPDATA%\BevDist\backups`. Cloud upload is optional and requires rclone to be installed and configured with a destination first:

```powershell
.\ops\backup-cloud.ps1 -CloudDestination 'myremote:BevDist'
```

The remote name is from your local rclone configuration. Use an rclone `crypt` remote if you want the cloud copy encrypted before upload. The script does not configure a cloud account or upload unless this parameter is supplied. Schedule the local backup command in Windows Task Scheduler, then test restoring a backup to a separate disposable database before relying on it.

For a daily local backup, open **Task Scheduler → Create Basic Task**, choose a daily trigger, and set the action to start `powershell.exe` with arguments:

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\BevDist\ops\backup-cloud.ps1"
```

Replace `C:\BevDist` with the actual clone folder. Run the task under the same Windows account used to configure BevDist.

To restore, stop the API, provide the backup path, and type the exact database name when prompted:

```powershell
.\ops\manage-server.ps1 -Action stop
.\ops\restore-db.ps1 -BackupFilePath "$env:LOCALAPPDATA\BevDist\backups\bevdist_YYYYMMDD_HHMMSS.dump"
.\ops\manage-server.ps1 -Action start
```

Restore replaces matching database objects and data. Confirm the backup path and target database before proceeding.

## Important boundaries

- Keep `mobileBackend\.env` private and out of Git. The frontend bundle contains only the local API address, never database credentials or the JWT secret.
- If phones/tablets need access later, that is a separate LAN configuration: choose a stable Surface IP, update the frontend build URL, bind the API to the LAN, and add a narrowly scoped Windows Firewall rule. Do not change this single-device setup to `0.0.0.0` by default.
- Updating the app means rebuilding `dist` on the Mac, copying it to the Surface, pulling the code update there, and restarting the API. Back up the database before applying schema migrations.
- These scripts do not install Windows software. Install Node.js and PostgreSQL first using their official installers.
