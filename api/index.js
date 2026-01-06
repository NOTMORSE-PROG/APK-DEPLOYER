const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Configuration from environment variables
const config = {
  github: {
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    token: process.env.GITHUB_TOKEN || ''
  },
  app: {
    name: process.env.APP_NAME || 'APK Downloader',
    description: process.env.APP_DESCRIPTION || 'Download APKs',
    tagPattern: process.env.APP_TAG_PATTERN || 'apk-'
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// GitHub API headers
const getGitHubHeaders = () => {
  const headers = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (config.github.token) {
    headers['Authorization'] = `token ${config.github.token}`;
  }
  return headers;
};

// API endpoint to get releases
app.get('/api/releases', async (req, res) => {
  try {
    const { owner, repo } = config.github;
    const url = `https://api.github.com/repos/${owner}/${repo}/releases`;

    const response = await axios.get(url, { headers: getGitHubHeaders() });
    const releases = response.data;

    // Filter releases that match the tag pattern
    const filteredReleases = releases.filter(release =>
      release.tag_name.startsWith(config.app.tagPattern)
    );

    // Format the releases for the frontend
    const formattedReleases = filteredReleases.map(release => {
      // Extract APK assets
      const apkAssets = release.assets.filter(asset =>
        asset.name.endsWith('.apk')
      );

      return {
        id: release.id,
        name: release.name || release.tag_name,
        tag: release.tag_name,
        branch: release.tag_name.replace(config.app.tagPattern, ''),
        description: release.body || 'No description available',
        publishedAt: release.published_at,
        author: release.author.login,
        apkFiles: apkAssets.map(asset => ({
          name: asset.name,
          size: asset.size,
          downloadUrl: asset.browser_download_url,
          downloadCount: asset.download_count
        }))
      };
    });

    res.json({
      success: true,
      app: config.app,
      releases: formattedReleases
    });
  } catch (error) {
    console.error('Error fetching releases:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch releases',
      message: error.message
    });
  }
});

// API endpoint to get app config
app.get('/api/config', (req, res) => {
  res.json({
    name: config.app.name,
    description: config.app.description
  });
});

// API endpoint to get active workflow runs (build progress)
app.get('/api/builds/active', async (req, res) => {
  try {
    const { owner, repo } = config.github;
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs`;

    const response = await axios.get(url, {
      headers: getGitHubHeaders(),
      params: {
        status: 'in_progress',
        per_page: 10
      }
    });

    const activeBuilds = response.data.workflow_runs
      .filter(run => run.name === 'Build and Release APK')
      .map(run => {
        // Extract branch from display_title which has format "APK Build from branch: {branch_name}"
        let branch = run.head_branch;
        const branchMatch = run.display_title?.match(/APK Build from branch:\s*(.+)/);
        if (branchMatch) {
          branch = branchMatch[1].trim();
        }

        return {
          id: run.id,
          branch: branch,
          status: run.status,
          startedAt: run.created_at,
          commitMessage: run.display_title,
          author: run.actor.login,
          url: run.html_url
        };
      });

    res.json({
      success: true,
      builds: activeBuilds
    });
  } catch (error) {
    console.error('Error fetching active builds:', error.message);
    res.json({
      success: false,
      builds: []
    });
  }
});

// API endpoint to get recent workflow runs (for build history)
app.get('/api/builds/recent', async (req, res) => {
  try {
    const { owner, repo } = config.github;
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs`;

    const response = await axios.get(url, {
      headers: getGitHubHeaders(),
      params: {
        per_page: 20
      }
    });

    const recentBuilds = response.data.workflow_runs
      .filter(run => run.name === 'Build and Release APK')
      .map(run => {
        const duration = run.updated_at && run.created_at
          ? Math.round((new Date(run.updated_at) - new Date(run.created_at)) / 1000)
          : null;

        // Extract branch from display_title which has format "APK Build from branch: {branch_name}"
        let branch = run.head_branch;
        const branchMatch = run.display_title?.match(/APK Build from branch:\s*(.+)/);
        if (branchMatch) {
          branch = branchMatch[1].trim();
        }

        return {
          id: run.id,
          branch: branch,
          status: run.status,
          conclusion: run.conclusion,
          startedAt: run.created_at,
          completedAt: run.updated_at,
          duration: duration,
          commitMessage: run.display_title,
          author: run.actor.login,
          url: run.html_url
        };
      });

    res.json({
      success: true,
      builds: recentBuilds
    });
  } catch (error) {
    console.error('Error fetching recent builds:', error.message);
    res.json({
      success: false,
      builds: []
    });
  }
});

// Export for Vercel
module.exports = app;
