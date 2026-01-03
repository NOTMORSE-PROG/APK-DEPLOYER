// API base URL
const API_URL = window.location.origin;

// Poll interval for active builds (in milliseconds)
const POLL_INTERVAL = 30000; // 30 seconds
let pollTimer = null;

// Helper function to extract and format date from APK filename
// APK filename format: SafeTransit-{branch}-{commit}-{YYYYMMDD-HHMMSS}.apk
// The timestamp in filename is UTC (from GitHub Actions runner)
function formatApkDate(apkName, uploadedAt, options) {
    // Try to extract date from filename first (more reliable)
    const dateMatch = apkName.match(/(\d{8})-(\d{6})\.apk$/);
    if (dateMatch) {
        const dateStr = dateMatch[1]; // YYYYMMDD
        const timeStr = dateMatch[2]; // HHMMSS
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = timeStr.substring(0, 2);
        const minute = timeStr.substring(2, 4);
        const second = timeStr.substring(4, 6);
        
        // Parse as UTC (GitHub Actions uses UTC), then display in Manila time
        const date = new Date(Date.UTC(
            parseInt(year), parseInt(month) - 1, parseInt(day),
            parseInt(hour), parseInt(minute), parseInt(second)
        ));
        if (!isNaN(date.getTime())) {
            return date.toLocaleString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Manila'
            });
        }
    }
    
    // Fallback to uploadedAt if filename parsing fails
    if (uploadedAt) {
        const date = new Date(uploadedAt);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString('en-PH', options);
        }
    }
    
    return 'Unknown Date';
}

// Global state
let allReleases = [];
let currentFilters = {
    branch: 'all'
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

    // Estimate build time: 25 minutes typical
    const estimatedBuildTime = 25 * 60; // 1500 seconds
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
    // Apply sorting: Main branch first, then by date (newest first)
    filtered.sort((a, b) => {
        // 1. Prioritize 'main' branch
        if (a.branch === 'main' && b.branch !== 'main') return -1;
        if (a.branch !== 'main' && b.branch === 'main') return 1;

        // 2. Sort by date (newest first)
        // Use the same timestamp extraction logic as in createReleaseCard for consistency
        const getTimestamp = (release) => {
            if (release.apkFiles && release.apkFiles.length > 0) {
                // Try to get timestamp from the latest APK filename
                const latestApk = release.apkFiles[0]; // Assuming apkFiles are already sorted or we just take the first
                // We should probably sort apkFiles here too if we want to be super accurate, 
                // but usually the first one is the one we care about or they are consistent.
                // Let's just use publishedAt for release sorting to keep it simple and fast,
                // unless we want to be super precise with the APK filename time.
                // Given the user's previous request about accuracy, let's try to be consistent.
                
                // Actually, let's stick to publishedAt for the release list sorting 
                // because extracting from APK filename for EVERY release during sort might be overkill 
                // and publishedAt is usually close enough for relative ordering of releases.
                // BUT, the user specifically complained about accuracy.
                // Let's use publishedAt for now as it's the standard release time.
                return new Date(release.publishedAt).getTime();
            }
            return new Date(release.publishedAt).getTime();
        };

        return new Date(b.publishedAt) - new Date(a.publishedAt);
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

    // Sort APKs by date in filename (descending) first
    if (release.apkFiles.length > 0) {
        release.apkFiles.sort((a, b) => {
            const getTimestamp = (name) => {
                const match = name.match(/(\d{8})-(\d{6})\.apk$/);
                return match ? match[1] + match[2] : '0';
            };
            return getTimestamp(b.name).localeCompare(getTimestamp(a.name));
        });
    }

    // Use the latest APK's date for the header, fallback to publishedAt
    let headerDateStr = release.publishedAt;
    if (release.apkFiles.length > 0) {
        // Use the formatted date from the latest APK
        const latestApk = release.apkFiles[0];
        // We need to get the date object to format it differently for the header if needed
        // But for consistency, let's use the same parsing logic
        const dateMatch = latestApk.name.match(/(\d{8})-(\d{6})\.apk$/);
        if (dateMatch) {
            const dateStr = dateMatch[1];
            const timeStr = dateMatch[2];
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hour = timeStr.substring(0, 2);
            const minute = timeStr.substring(2, 4);
            const second = timeStr.substring(4, 6);
            
            const date = new Date(Date.UTC(
                parseInt(year), parseInt(month) - 1, parseInt(day),
                parseInt(hour), parseInt(minute), parseInt(second)
            ));
            if (!isNaN(date.getTime())) {
                headerDateStr = date.toISOString();
            }
        } else if (latestApk.uploadedAt) {
            headerDateStr = latestApk.uploadedAt;
        }
    }

    const publishDate = new Date(headerDateStr).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Manila'
    });

    let apkFilesHTML = '';
    if (release.apkFiles.length > 0) {
        // Sort APKs by date in filename (descending) to ensure "Latest" is actually the newest
        release.apkFiles.sort((a, b) => {
            const getTimestamp = (name) => {
                const match = name.match(/(\d{8})-(\d{6})\.apk$/);
                return match ? match[1] + match[2] : '0';
            };
            return getTimestamp(b.name).localeCompare(getTimestamp(a.name));
        });

        const latestApk = release.apkFiles[0];
        const olderApks = release.apkFiles.slice(1);
        const releaseId = release.tag.replace(/[^a-zA-Z0-9]/g, '_');

        apkFilesHTML = '<div class="apk-files">';

        // Show latest APK
        const latestSize = (latestApk.size / (1024 * 1024)).toFixed(2);
        const latestDate = formatApkDate(latestApk.name, latestApk.uploadedAt, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Manila'
        });
        apkFilesHTML += `
            <div class="apk-file latest">
                <div class="apk-file-header">
                    <div class="apk-file-name">${latestApk.name}</div>
                    <span class="latest-badge">Latest</span>
                </div>
                <div class="apk-file-info">Size: ${latestSize} MB • ${latestDate}</div>
                <a href="${latestApk.downloadUrl}" class="download-btn" download>
                    Download APK
                </a>
            </div>
        `;

        // Show older APKs with progressive loading
        if (olderApks.length > 0) {
            const initialShow = 3; // Show first 3 older builds
            const loadMoreIncrement = 5; // Load 5 more each time

            apkFilesHTML += `
                <div class="older-apks-container" id="container-${releaseId}">
                    <div class="older-apks-header" onclick="toggleOlderApksSection('${releaseId}', ${olderApks.length})">
                        <span class="older-apks-title">Older Builds (${olderApks.length})</span>
                        <span class="toggle-icon">▼</span>
                    </div>
                    <div class="older-apks-content" id="older-${releaseId}" style="display: none;">
            `;

            // Render all older APKs, but hide some with CSS
            olderApks.forEach((apk, index) => {
                const size = (apk.size / (1024 * 1024)).toFixed(2);
                const apkDate = formatApkDate(apk.name, apk.uploadedAt, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Manila'
                });
                const isInitiallyVisible = index < initialShow;
                const hiddenClass = isInitiallyVisible ? '' : 'older-apk-hidden';

                apkFilesHTML += `
                    <div class="apk-file older-apk ${hiddenClass}" data-index="${index}">
                        <div class="apk-file-name">${apk.name}</div>
                        <div class="apk-file-info">Size: ${size} MB • ${apkDate}</div>
                        <a href="${apk.downloadUrl}" class="download-btn" download>
                            Download APK
                        </a>
                    </div>
                `;
            });

            // Add "Load More" button if there are more than initialShow builds
            if (olderApks.length > initialShow) {
                const remaining = olderApks.length - initialShow;
                apkFilesHTML += `
                    <button class="load-more-btn" id="loadmore-${releaseId}"
                            onclick="loadMoreOlderApks('${releaseId}', ${olderApks.length}, ${loadMoreIncrement})">
                        Load ${Math.min(remaining, loadMoreIncrement)} More Builds
                    </button>
                `;
            }

            apkFilesHTML += `
                    </div>
                </div>
            `;
        }

        apkFilesHTML += '</div>';
    } else {
        apkFilesHTML = '<p style="color: #999; text-align: center;">No APK files available</p>';
    }

    card.innerHTML = `
        <div class="release-header">
            <h2 class="release-name">${release.name}</h2>
            <span class="release-branch">${release.branch}</span>
        </div>
        <div class="release-meta">
            <span class="meta-item">📅 ${publishDate}</span>
            <span class="meta-item">👤 ${release.author}</span>
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
    const clearFiltersBtn = document.getElementById('clear-filters');

    branchFilter.addEventListener('change', (e) => {
        currentFilters.branch = e.target.value;
        renderReleases();
    });

    clearFiltersBtn.addEventListener('click', () => {
        currentFilters = { branch: 'all' };
        branchFilter.value = 'all';
        renderReleases();
    });
});

// Toggle older APKs section visibility
function toggleOlderApksSection(releaseId, totalCount) {
    const content = document.getElementById(`older-${releaseId}`);
    const header = event.currentTarget;
    const icon = header.querySelector('.toggle-icon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

// Load more older APKs progressively
function loadMoreOlderApks(releaseId, totalCount, increment) {
    const container = document.getElementById(`older-${releaseId}`);
    const button = document.getElementById(`loadmore-${releaseId}`);
    const hiddenApks = container.querySelectorAll('.older-apk-hidden');

    if (hiddenApks.length === 0) {
        button.style.display = 'none';
        return;
    }

    // Show next batch
    const toShow = Math.min(increment, hiddenApks.length);
    for (let i = 0; i < toShow; i++) {
        hiddenApks[i].classList.remove('older-apk-hidden');
    }

    // Update button text or hide it
    const remaining = hiddenApks.length - toShow;
    if (remaining > 0) {
        button.textContent = `Load ${Math.min(remaining, increment)} More Builds`;
    } else {
        button.style.display = 'none';
    }
}
