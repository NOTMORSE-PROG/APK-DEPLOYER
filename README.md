# APK Deployer

Simple website that auto-fetches and displays APK releases from GitHub with build progress tracking and version archiving.

## What It Does

- Shows latest APK releases from your GitHub repo with download buttons
- Displays live build progress with animated bars
- Automatically archives older versions to a dedicated archive page
- Auto-refreshes every 30 seconds
- Works for any React Native/Expo project
- Deploy to Vercel or run locally

## Quick Start

### Local Development

```bash
npm install
npm start
```

Open: **http://localhost:3000**

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

1. Push this repo to GitHub
2. Import to Vercel
3. Add environment variables (see Configuration below)
4. Deploy

## How Builds Work

### Push to any branch → APK is built automatically

```bash
git push origin main           # → Creates apk-main
git push origin any-branch     # → Creates apk-any-branch
```

**Works with ANY branch name!**

Each push creates a release tagged `apk-{branch-name}` with the compiled APK. The website automatically detects and displays all APK releases.

## Workflow Configuration

If using the included workflow (`.github/workflows/build-apk.yml`):
- Triggers on push to ANY branch
- Creates optimized production builds
- Tags releases as `apk-{branch-name}`

## Configuration

### Option 1: Environment Variables (Recommended for Vercel)

Copy `.env.example` to `.env` and configure:

```env
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name
GITHUB_TOKEN=your-github-token
APP_NAME=Your App Name
APP_DESCRIPTION=Download APKs
APP_TAG_PATTERN=apk-
PORT=3000
```

### Option 2: Config File (Local Development)

Edit `config.json`:

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
  },
  "server": {
    "port": 3000
  }
}
```

**GitHub Token (Optional but Recommended):**
- Higher API rate limits (5000/hour instead of 60/hour)
- Create at: https://github.com/settings/tokens
- Required scope: `public_repo`

## Features

### Archive Page
- Main page shows the latest version of each branch
- Older versions automatically moved to archive page (`/archive.html`)
- Easy access to all historical builds
- Same download and progress tracking features

### Android Download Support
- Uses `target="_blank"` to fix Android download issues
- Direct APK downloads work seamlessly on mobile devices

## Reuse for Another Project

**1. Fork or clone this repository**

**2. Update configuration**
- Edit `config.json` with your repo details
- Or set environment variables for Vercel deployment

**3. (Optional) Copy workflows to your project**
If you need APK build workflows:
```bash
cp -r .github /path/to/your-project/
```

**4. Deploy or run locally**
```bash
npm install
npm start
```

**That's it!** Point it at any GitHub repo with APK releases.

## GitHub Permissions Required

Go to: `https://github.com/[owner]/[repo]/settings/actions`

Enable:
- ✅ "Read and write permissions"

## File Structure

```
apk-deployer/
├── server.js              # Local development server
├── api/
│   └── index.js          # Vercel serverless API
├── public/
│   ├── index.html        # Main page (latest releases)
│   ├── archive.html      # Archive page (older versions)
│   ├── script.js         # Main page JavaScript
│   ├── archive-script.js # Archive page JavaScript
│   └── styles.css        # Shared styling
├── config.json           # Configuration file
├── .env.example          # Environment variables template
├── vercel.json           # Vercel deployment config
├── package.json          # Dependencies
└── .github/workflows/
    └── build-apk.yml     # APK build workflow (optional)
```

## Build Types

The default workflow creates production (release) APKs:
- Tag format: `apk-{branch}` (e.g., `apk-main`, `apk-develop`)
- Optimized for distribution
- Smaller file size
- Ready for testing and deployment

## Troubleshooting

**No APKs showing?**
- Push code to trigger first build
- Check: https://github.com/[owner]/[repo]/actions
- Verify GitHub Actions permissions enabled

**Build failing?**
- Check Actions tab for error logs
- For Expo projects: Add `EXPO_TOKEN` secret (optional)

**API rate limit?**
- Add GitHub token to `config.json` or `.env` file
- Get token at: https://github.com/settings/tokens

## Summary

- **Simple Setup:** Configure once, deploy anywhere (Vercel or local)
- **Automatic Archiving:** Latest releases on main page, older versions in archive
- **Live Progress:** Real-time build tracking with animated progress bars
- **Mobile-Friendly:** Fixed download issues for Android devices
- **Flexible:** Works with any GitHub repo that publishes APK releases
- **Auto-builds:** Push code → APK ready in ~5-7 minutes (with GitHub Actions)

## License

MIT
