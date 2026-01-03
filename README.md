# APK Downloader

Simple website that auto-fetches and displays APK releases from GitHub with build progress tracking.

## What It Does

- Shows all APK releases from your GitHub repo
- Displays live build progress with animated bars
- Auto-refreshes every 30 seconds
- Works for any React Native/Expo project

## Quick Start (Current Project: SafeTransit)

```bash
cd c:\SafeTransit\apk-downloader
npm install
npm start
```

Open: **http://localhost:3000**

## How Builds Work

### Push to any branch → APK is built automatically

```bash
git push origin main           # → Creates apk-main
git push origin develop        # → Creates apk-develop + apk-dev-develop (dev build)
git push origin any-branch     # → Creates apk-any-branch
```

**Works with ANY branch name!**

Website shows them all with download buttons.

## Workflows Already Set Up

**Production APKs:** `.github/workflows/build-apk.yml`
- Optimized release builds
- **Triggers on push to ANY branch**

**Development APKs:** `.github/workflows/build-dev-apk.yml`
- Debug builds with hot reload
- Triggers on push to develop, dev/**
- Manual trigger available

## Configuration

Edit `config.json` to point to your GitHub repo:

```json
{
  "github": {
    "owner": "your-username",
    "repo": "your-repo-name",
    "token": ""
  },
  "app": {
    "name": "Your App Name",
    "description": "Download APKs",
    "tagPattern": "apk-"
  }
}
```

**Optional:** Add GitHub token for higher API rate limits (5000/hour instead of 60/hour)
- Create at: https://github.com/settings/tokens
- Scope: `public_repo`

## Reuse for Another Project

### Copy/Paste Workflow:

**1. Copy the folder**
```bash
xcopy /E /I c:\SafeTransit\apk-downloader c:\YourNewProject\apk-downloader
```

**2. Edit config.json**
```json
{
  "github": {
    "owner": "your-username",
    "repo": "your-new-repo"
  },
  "app": {
    "name": "Your New App"
  }
}
```

**3. Copy workflows to your new project**
```bash
xcopy /E /I c:\SafeTransit\apk-downloader\.github c:\YourNewProject\.github
```

**4. Start the website**
```bash
cd c:\YourNewProject\apk-downloader
npm install
npm start
```

**That's it!** Website now shows APKs from your new project.

## GitHub Permissions Required

Go to: `https://github.com/[owner]/[repo]/settings/actions`

Enable:
- ✅ "Read and write permissions"

You DON'T need:
- ❌ "Allow GitHub Actions to create and approve pull requests"

## File Structure

```
apk-downloader/
├── server.js          # Backend API
├── config.json        # Configuration
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Frontend
│   ├── styles.css     # Styling
│   └── script.js      # Build progress tracking
└── .github/workflows/
    ├── build-apk.yml      # Production builds
    └── build-dev-apk.yml  # Development builds
```

## Development vs Production Builds

**Production (Release APK):**
- Tag: `apk-{branch}` (e.g., `apk-main`)
- Optimized, smaller size
- For testing/distribution

**Development (Debug APK):**
- Tag: `apk-dev-{branch}` (e.g., `apk-dev-develop`)
- Hot reload, dev menu enabled
- Connects to Metro bundler
- Run `npm start` on your computer, app connects automatically

## Troubleshooting

**No APKs showing?**
- Push code to trigger first build
- Check: https://github.com/[owner]/[repo]/actions
- Verify GitHub Actions permissions enabled

**Build failing?**
- Check Actions tab for error logs
- For Expo projects: Add `EXPO_TOKEN` secret (optional)

**API rate limit?**
- Add GitHub token to `config.json`

## That's It

- Website: Shows all APKs with progress tracking
- Auto-builds: Push code → APK ready in ~5-7 minutes
- Portable: Copy folder + edit config.json → works for any project
