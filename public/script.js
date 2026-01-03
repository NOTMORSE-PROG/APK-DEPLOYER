// API base URL
const API_URL = window.location.origin;

// Poll interval for active builds (in milliseconds)
const POLL_INTERVAL = 30000; // 30 seconds
let pollTimer = null;

// Global state
let allReleases = [];
let currentFilters = {
    branch: 'all',
    sort: 'date-desc'
};

// Load app configuration
async function loadConfig() {
    try {
        const response = await fetch(`${API_URL}/api/config`);
        const config = await response.json();

        document.getElementById('app-name').textContent = config.name;
        document.getElementById('app-description').textContent = config.description;
        document.title = `${config.name} - APK Downloader`;
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// Load active builds (builds in progress)
async function loadActiveBuilds() {
    try {
        const response = await fetch(`${API_URL}/api/builds/active`);
        const data = await response.json();

        const container = document.getElementById('active-builds-container');

        if (!data.success || data.builds.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        const buildsHtml = data.builds.map(build => createActiveBuildCard(build)).join('');
        document.getElementById('active-builds-list').innerHTML = buildsHtml;

        // Reload releases when build completes
        scheduleNextPoll();
    } catch (error) {
        console.error('Error loading active builds:', error);
    }
}

// Create active build card HTML
function createActiveBuildCard(build) {
    const startTime = new Date(build.startedAt);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const elapsedMin = Math.floor(elapsed / 60);
    const elapsedSec = elapsed % 60;

    // Estimate build time: 6 minutes typical
    const estimatedBuildTime = 6 * 60; // 360 seconds
    const progress = Math.min(95, Math.floor((elapsed / estimatedBuildTime) * 100));

    return `
        <div class="active-build-card">
            <div class="build-progress-bar">
                <div class="build-progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="build-info">
                <div class="build-branch">
                    <span class="build-status-icon">⚙️</span>
                    Building: <strong>${build.branch}</strong>
                    <span class="build-progress-text">${progress}%</span>
                </div>
                <div class="build-details">
                    <p>${build.commitMessage}</p>
                    <p class="build-meta">
                        Started ${elapsedMin}m ${elapsedSec}s ago • By ${build.author}
                    </p>
                </div>
            </div>
            <a href="${build.url}" target="_blank" class="build-link">View Progress</a>
        </div>
    `;
}

// Schedule next poll
function scheduleNextPoll() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => {
        loadActiveBuilds();
        loadReleases();
    }, POLL_INTERVAL);
}

// Load releases from API
async function loadReleases() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const containerEl = document.getElementById('releases-container');

    // Show loading
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    containerEl.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/api/releases`);
        const data = await response.json();

        loadingEl.style.display = 'none';

        if (!data.success) {
            throw new Error(data.message || 'Failed to load releases');
        }

        if (data.releases.length === 0) {
            containerEl.innerHTML = '<div class="no-releases">No APK releases found</div>';
            document.getElementById('filters-container').style.display = 'none';
            return;
        }

        // Store releases and populate filters
        allReleases = data.releases;
        populateFilters();
        renderReleases();

    } catch (error) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        document.getElementById('error-message').textContent =
            `Error: ${error.message}`;
    }
}

// Populate filter dropdowns
function populateFilters() {
    const branchFilter = document.getElementById('branch-filter');
    const uniqueBranches = [...new Set(allReleases.map(r => r.branch))].sort();

    // Clear existing options except "All"
    branchFilter.innerHTML = '<option value="all">All Branches</option>';

    // Add branch options
    uniqueBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        branchFilter.appendChild(option);
    });

    // Show filters if we have releases
    document.getElementById('filters-container').style.display = 'block';
}

// Filter and sort releases
function getFilteredReleases() {
    let filtered = [...allReleases];

    // Apply branch filter
    if (currentFilters.branch !== 'all') {
        filtered = filtered.filter(r => r.branch === currentFilters.branch);
    }

    // Apply sorting
    filtered.sort((a, b) => {
        switch (currentFilters.sort) {
            case 'date-desc':
                return new Date(b.publishedAt) - new Date(a.publishedAt);
            case 'date-asc':
                return new Date(a.publishedAt) - new Date(b.publishedAt);
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            default:
                return 0;
        }
    });

    return filtered;
}

// Render releases based on current filters
function renderReleases() {
    const containerEl = document.getElementById('releases-container');
    const filtered = getFilteredReleases();

    containerEl.innerHTML = '';

    if (filtered.length === 0) {
        containerEl.innerHTML = '<div class="no-releases">No releases match your filters</div>';
        return;
    }

    filtered.forEach(release => {
        const card = createReleaseCard(release);
        containerEl.appendChild(card);
    });
}

// Create a release card element
function createReleaseCard(release) {
    const card = document.createElement('div');
    card.className = 'release-card';

    const publishDate = new Date(release.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let apkFilesHTML = '';
    if (release.apkFiles.length > 0) {
        apkFilesHTML = '<div class="apk-files">';
        release.apkFiles.forEach(apk => {
            const sizeInMB = (apk.size / (1024 * 1024)).toFixed(2);
            apkFilesHTML += `
                <div class="apk-file">
                    <div class="apk-file-name">${apk.name}</div>
                    <div class="apk-file-info">
                        Size: ${sizeInMB} MB | Downloads: ${apk.downloadCount}
                    </div>
                    <a href="${apk.downloadUrl}" class="download-btn" download>
                        Download APK
                    </a>
                </div>
            `;
        });
        apkFilesHTML += '</div>';
    } else {
        apkFilesHTML = '<p style="color: #999; text-align: center;">No APK files available</p>';
    }

    card.innerHTML = `
        <div class="release-header">
            <h2 class="release-name">${release.name}</h2>
            <span class="release-branch">${release.branch}</span>
        </div>
        <div class="release-info">
            <p><strong>Version:</strong> ${release.tag}</p>
            <p><strong>Published:</strong> ${publishDate}</p>
            <p><strong>Author:</strong> ${release.author}</p>
        </div>
        <div class="release-description">
            ${formatDescription(release.description)}
        </div>
        ${apkFilesHTML}
    `;

    return card;
}

// Format release description
function formatDescription(text) {
    if (!text || text === 'No description available') {
        return '<em>No description available</em>';
    }

    // Convert markdown-style text to HTML (simple version)
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadActiveBuilds();
    loadReleases();

    // Setup filter event listeners
    const branchFilter = document.getElementById('branch-filter');
    const sortFilter = document.getElementById('sort-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');

    branchFilter.addEventListener('change', (e) => {
        currentFilters.branch = e.target.value;
        renderReleases();
    });

    sortFilter.addEventListener('change', (e) => {
        currentFilters.sort = e.target.value;
        renderReleases();
    });

    clearFiltersBtn.addEventListener('click', () => {
        currentFilters = { branch: 'all', sort: 'date-desc' };
        branchFilter.value = 'all';
        sortFilter.value = 'date-desc';
        renderReleases();
    });
});
