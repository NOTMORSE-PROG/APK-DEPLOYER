// API base URL
const API_URL = window.location.origin;

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
// Track current page for each release's APK files
let apkPages = {}; // { releaseId: currentPage }
const apksPerPage = 3;

// Load app configuration
async function loadConfig() {
    try {
        const response = await fetch(`${API_URL}/api/config`);
        const config = await response.json();

        document.getElementById('app-name').textContent = config.name;
        document.getElementById('app-description').textContent = 'All available versions';
        document.title = `All Versions - ${config.name}`;
    } catch (error) {
        console.error('Error loading config:', error);
    }
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

    // Sort: Main branch first, then by date (newest first)
    filtered.sort((a, b) => {
        // 1. Prioritize 'main' branch
        if (a.branch === 'main' && b.branch !== 'main') return -1;
        if (a.branch !== 'main' && b.branch === 'main') return 1;

        // 2. Sort by date (newest first)
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

// Create a release card element with paginated APK files
function createReleaseCard(release) {
    const card = document.createElement('div');
    card.className = 'release-card';
    const releaseId = release.tag.replace(/[^a-zA-Z0-9]/g, '_');

    // Sort APKs by date in filename (descending)
    if (release.apkFiles.length > 0) {
        release.apkFiles.sort((a, b) => {
            const getTimestamp = (name) => {
                const match = name.match(/(\d{8})-(\d{6})\.apk$/);
                return match ? match[1] + match[2] : '0';
            };
            return getTimestamp(b.name).localeCompare(getTimestamp(a.name));
        });
    }

    // Initialize page for this release if not exists
    if (!apkPages[releaseId]) {
        apkPages[releaseId] = 1;
    }

    // Use the latest APK's date for the header
    let headerDateStr = release.publishedAt;
    if (release.apkFiles.length > 0) {
        const latestApk = release.apkFiles[0];
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
        const totalApks = release.apkFiles.length;
        const totalPages = Math.ceil(totalApks / apksPerPage);
        const currentPage = apkPages[releaseId];

        // Calculate which APKs to show
        const startIndex = (currentPage - 1) * apksPerPage;
        const endIndex = Math.min(startIndex + apksPerPage, totalApks);
        const apksToShow = release.apkFiles.slice(startIndex, endIndex);

        apkFilesHTML = `<div class="apk-files archive-view" id="apks-${releaseId}">`;
        apkFilesHTML += `<div class="archive-header"><strong>All Versions (${totalApks}) - Showing ${startIndex + 1}-${endIndex}</strong></div>`;

        // Show APK files for current page
        apksToShow.forEach((apk, index) => {
            const actualIndex = startIndex + index;
            const size = (apk.size / (1024 * 1024)).toFixed(2);
            const apkDate = formatApkDate(apk.name, apk.uploadedAt, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Manila'
            });

            // Add visual indicator for the latest version
            const latestIndicator = actualIndex === 0 ? '<span class="version-indicator">Latest</span>' : '';

            apkFilesHTML += `
                <div class="apk-file archive-apk ${actualIndex === 0 ? 'latest' : ''}">
                    <div class="apk-file-header">
                        <div class="apk-file-name">${apk.name}</div>
                        ${latestIndicator}
                    </div>
                    <div class="apk-file-info">Size: ${size} MB • ${apkDate}</div>
                    <a href="${apk.downloadUrl}" class="download-btn" target="_blank" rel="noopener noreferrer">
                        Download APK
                    </a>
                </div>
            `;
        });

        // Add pagination controls if there's more than one page
        if (totalPages > 1) {
            apkFilesHTML += `<div class="apk-pagination">`;

            // Previous button
            if (currentPage > 1) {
                apkFilesHTML += `<button class="page-btn" onclick="goToApkPage('${releaseId}', ${currentPage - 1})">‹ Previous</button>`;
            } else {
                apkFilesHTML += `<button class="page-btn" disabled>‹ Previous</button>`;
            }

            // Page numbers (simple version - just show all pages)
            for (let i = 1; i <= totalPages; i++) {
                if (i === currentPage) {
                    apkFilesHTML += `<button class="page-btn active">${i}</button>`;
                } else {
                    apkFilesHTML += `<button class="page-btn" onclick="goToApkPage('${releaseId}', ${i})">${i}</button>`;
                }
            }

            // Next button
            if (currentPage < totalPages) {
                apkFilesHTML += `<button class="page-btn" onclick="goToApkPage('${releaseId}', ${currentPage + 1})">Next ›</button>`;
            } else {
                apkFilesHTML += `<button class="page-btn" disabled>Next ›</button>`;
            }

            apkFilesHTML += `</div>`;
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

// Navigate to a specific page for a release's APK files
function goToApkPage(releaseId, page) {
    apkPages[releaseId] = page;
    renderReleases();
    // Scroll to the release card
    const element = document.getElementById(`apks-${releaseId}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadReleases();

    // Setup filter event listeners
    const branchFilter = document.getElementById('branch-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');

    branchFilter.addEventListener('change', (e) => {
        currentFilters.branch = e.target.value;
        apkPages = {}; // Reset APK pages when filter changes
        renderReleases();
    });

    clearFiltersBtn.addEventListener('click', () => {
        currentFilters = { branch: 'all' };
        branchFilter.value = 'all';
        apkPages = {}; // Reset APK pages
        renderReleases();
    });
});
