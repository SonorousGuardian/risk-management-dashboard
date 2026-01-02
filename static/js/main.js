/**
 * Risk Management Dashboard - Main JavaScript
 * Handles API calls, data management, and UI interactions
 */

// API Base URL
const API_BASE = '/api';

// State management
const state = {
    risks: [],
    stats: null,
    currentPage: 1,
    totalPages: 1,
    pageSize: 20,
    filters: {
        status: '',
        category: '',
        owner: '',
        is_mitigated: '',
        search: '',
        sort_by: '-risk_score'
    },
    matrixFilter: null
};

// ============================================
// API Functions
// ============================================

/**
 * Fetch data from API
 */
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('Error', 'Failed to fetch data from server', 'error');
        throw error;
    }
}

/**
 * Get dashboard statistics
 */
async function fetchStats() {
    try {
        const stats = await fetchAPI('/stats/');
        state.stats = stats;
        updateKPICards(stats);
        return stats;
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

/**
 * Get risks with filters and pagination
 */
async function fetchRisks(page = 1) {
    try {
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', state.pageSize);
        
        // Add filters
        if (state.filters.status) params.append('status', state.filters.status);
        if (state.filters.category) params.append('category', state.filters.category);
        if (state.filters.owner) params.append('owner', state.filters.owner);
        if (state.filters.is_mitigated) params.append('is_mitigated', state.filters.is_mitigated);
        if (state.filters.search) params.append('search', state.filters.search);
        if (state.filters.sort_by) params.append('sort_by', state.filters.sort_by);
        
        // Add matrix filter if set
        if (state.matrixFilter) {
            params.append('min_score', state.matrixFilter.score);
            params.append('max_score', state.matrixFilter.score);
        }
        
        const response = await fetchAPI(`/risks/?${params.toString()}`);
        
        state.risks = response.results || response;
        state.currentPage = page;
        state.totalPages = Math.ceil((response.count || state.risks.length) / state.pageSize);
        
        renderRiskTable(state.risks);
        updatePagination(response.count || state.risks.length);
        
        return response;
    } catch (error) {
        console.error('Error fetching risks:', error);
    }
}

/**
 * Toggle risk mitigation status
 */
async function toggleMitigation(riskId) {
    try {
        const response = await fetchAPI(`/risks/${riskId}/toggle-mitigated/`, {
            method: 'POST'
        });
        
        showToast('Success', response.message, 'success');
        
        // Refresh all data including charts
        await refreshAllData();
        
        return response;
    } catch (error) {
        console.error('Error toggling mitigation:', error);
        showToast('Error', 'Failed to update mitigation status', 'error');
    }
}

/**
 * Sync data from CSV
 */
async function syncFromCSV() {
    try {
        showToast('Syncing', 'Loading data from CSV file...', 'info');
        
        const response = await fetchAPI('/sync/csv/', {
            method: 'POST'
        });
        
        if (response.success) {
            showToast('Success', `Synced ${response.total_processed} risks from CSV`, 'success');
            await refreshAllData();
        } else {
            showToast('Error', response.message, 'error');
        }
        
        return response;
    } catch (error) {
        console.error('Error syncing CSV:', error);
    }
}

/**
 * Sync data from Google Sheets (supports dynamic sheet ID/URL)
 */
async function syncFromSheets(sheetIdOrUrl = null) {
    try {
        showToast('Syncing', 'Connecting to Google Sheets...', 'info');
        
        const body = {};
        if (sheetIdOrUrl) {
            // Extract sheet ID from URL if full URL provided
            const urlMatch = sheetIdOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            body.sheet_id = urlMatch ? urlMatch[1] : sheetIdOrUrl;
        }
        
        const response = await fetchAPI('/sync/sheets/', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        
        if (response.success) {
            showToast('Success', response.message, 'success');
            await refreshAllData();
        } else {
            showToast('Warning', response.message, 'warning');
        }
        
        return response;
    } catch (error) {
        console.error('Error syncing sheets:', error);
    }
}

/**
 * Open Google Sheets modal
 */
function openSheetsModal() {
    const modal = document.getElementById('sheetsModal');
    if (modal) modal.classList.remove('hidden');
}

/**
 * Close Google Sheets modal
 */
function closeSheetsModal() {
    const modal = document.getElementById('sheetsModal');
    if (modal) modal.classList.add('hidden');
    const input = document.getElementById('sheetUrlInput');
    if (input) input.value = '';
}

/**
 * Refresh all dashboard data
 */
async function refreshAllData() {
    await Promise.all([
        fetchStats(),
        fetchRisks(1),
        fetchMatrixData(),
        fetchChartData()
    ]);
}

// ============================================
// UI Update Functions
// ============================================

/**
 * Update KPI cards with stats
 */
function updateKPICards(stats) {
    document.getElementById('totalRisks').textContent = stats.total_risks;
    document.getElementById('criticalRisks').textContent = stats.critical_risks;
    document.getElementById('openRisks').textContent = stats.open_risks;
    document.getElementById('mitigatedRisks').textContent = stats.mitigated_risks;
    document.getElementById('avgScore').textContent = stats.average_score;
    document.getElementById('mitigatedPct').textContent = `${stats.mitigated_percentage}% of total`;
    
    // Update average score level
    const avgScoreLevel = document.getElementById('avgScoreLevel');
    if (stats.average_score >= 15) {
        avgScoreLevel.textContent = 'Critical Level';
        avgScoreLevel.className = 'text-xs text-red-400/70 mt-1';
    } else if (stats.average_score >= 8) {
        avgScoreLevel.textContent = 'High Level';
        avgScoreLevel.className = 'text-xs text-orange-400/70 mt-1';
    } else if (stats.average_score >= 4) {
        avgScoreLevel.textContent = 'Medium Level';
        avgScoreLevel.className = 'text-xs text-yellow-400/70 mt-1';
    } else {
        avgScoreLevel.textContent = 'Low Level';
        avgScoreLevel.className = 'text-xs text-green-400/70 mt-1';
    }
}

/**
 * Render risk table
 */
function renderRiskTable(risks) {
    const tbody = document.getElementById('riskTableBody');
    
    if (!risks || risks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-4 py-8 text-center text-gray-400">
                    <svg class="w-12 h-12 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-lg font-medium">No risks found</p>
                    <p class="text-sm">Try adjusting your filters or sync data from CSV</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = risks.map(risk => `
        <tr class="fade-in hover:bg-sea-green-500/5">
            <td class="px-4 py-3">
                <input type="checkbox" 
                    class="mitigation-checkbox rounded bg-dark-bg border-dark-border text-sea-green-500 focus:ring-sea-green-500" 
                    data-id="${risk.id}"
                    ${risk.is_mitigated ? 'checked' : ''}>
            </td>
            <td class="px-4 py-3 font-mono text-sea-green-400">${risk.risk_id}</td>
            <td class="px-4 py-3 font-medium text-gray-200">${risk.title}</td>
            <td class="px-4 py-3 text-gray-400">${risk.risk_owner}</td>
            <td class="px-4 py-3 text-gray-400">${risk.risk_category}</td>
            <td class="px-4 py-3 text-center">
                <span class="score-badge ${getScoreClass(risk.risk_score)}">${risk.risk_score}</span>
            </td>
            <td class="px-4 py-3">
                <span class="status-badge status-${risk.status.toLowerCase()}">${risk.status}</span>
            </td>
            <td class="px-4 py-3 effectiveness-${risk.control_effectiveness.toLowerCase()}">${risk.control_effectiveness}</td>
            <td class="px-4 py-3 text-gray-400 text-sm">${formatDate(risk.last_updated)}</td>
        </tr>
    `).join('');
    
    // Add event listeners to checkboxes
    document.querySelectorAll('.mitigation-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            toggleMitigation(this.dataset.id);
        });
    });
}

/**
 * Update pagination info
 */
function updatePagination(totalCount) {
    const start = (state.currentPage - 1) * state.pageSize + 1;
    const end = Math.min(state.currentPage * state.pageSize, totalCount);
    
    document.getElementById('riskCount').textContent = `(${totalCount} risks)`;
    document.getElementById('paginationInfo').textContent = `Showing ${start}-${end} of ${totalCount} risks`;
    document.getElementById('pageInfo').textContent = `Page ${state.currentPage} of ${state.totalPages || 1}`;
    
    document.getElementById('prevPage').disabled = state.currentPage <= 1;
    document.getElementById('nextPage').disabled = state.currentPage >= state.totalPages;
}

/**
 * Get score badge class
 */
function getScoreClass(score) {
    if (score >= 15) return 'score-critical';
    if (score >= 8) return 'score-high';
    if (score >= 4) return 'score-medium';
    return 'score-low';
}

/**
 * Format date
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Show toast notification
 */
function showToast(title, message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    // Set icon and colors based on type
    const icons = {
        success: `<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>`,
        error: `<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>`,
        warning: `<svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>`,
        info: `<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`
    };
    
    const bgColors = {
        success: 'bg-green-500/20',
        error: 'bg-red-500/20',
        warning: 'bg-yellow-500/20',
        info: 'bg-blue-500/20'
    };
    
    toastIcon.innerHTML = icons[type] || icons.info;
    toastIcon.className = `w-8 h-8 rounded-full flex items-center justify-center ${bgColors[type] || bgColors.info}`;
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Show toast
    toast.classList.add('toast-visible');
    
    // Hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('toast-visible');
    }, 4000);
}

// ============================================
// Event Listeners
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Initial data load
    refreshAllData();
    
    // Update timestamp
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleString();
    
    // Sync buttons
    document.getElementById('syncCsvBtn')?.addEventListener('click', syncFromCSV);
    document.getElementById('syncSheetsBtn')?.addEventListener('click', function() {
        openSheetsModal();
    });
    
    // ============================================
    // Sidebar Toggle Handlers
    // ============================================
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    function openSidebar() {
        sidebar?.classList.remove('-translate-x-full');
        sidebarOverlay?.classList.remove('hidden');
        setTimeout(() => sidebarOverlay?.classList.remove('opacity-0'), 10);
    }
    
    function closeSidebar() {
        sidebar?.classList.add('-translate-x-full');
        sidebarOverlay?.classList.add('opacity-0');
        setTimeout(() => sidebarOverlay?.classList.add('hidden'), 300);
    }
    
    document.getElementById('sidebarToggle')?.addEventListener('click', openSidebar);
    document.getElementById('closeSidebar')?.addEventListener('click', closeSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);
    
    // ============================================
    // Google Sheets Modal Handlers
    // ============================================
    document.getElementById('closeSheetsModal')?.addEventListener('click', closeSheetsModal);
    document.getElementById('cancelSheetsSync')?.addEventListener('click', closeSheetsModal);
    document.getElementById('sheetsModalOverlay')?.addEventListener('click', closeSheetsModal);
    
    document.getElementById('sheetsForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const sheetUrl = document.getElementById('sheetUrlInput')?.value;
        if (sheetUrl) {
            closeSheetsModal();
            await syncFromSheets(sheetUrl);
        }
    });
    
    // ============================================
    // Upload Modal Handlers
    // ============================================
    const uploadModal = document.getElementById('uploadModal');
    const uploadForm = document.getElementById('uploadForm');
    const csvFileInput = document.getElementById('csvFileInput');
    const dropZone = document.getElementById('dropZone');
    const selectedFileName = document.getElementById('selectedFileName');
    const submitUpload = document.getElementById('submitUpload');
    
    // Open upload modal
    document.getElementById('uploadCsvBtn')?.addEventListener('click', function() {
        uploadModal?.classList.remove('hidden');
    });
    
    // Close upload modal
    function closeModal() {
        uploadModal?.classList.add('hidden');
        csvFileInput.value = '';
        selectedFileName?.classList.add('hidden');
        submitUpload.disabled = true;
    }
    
    document.getElementById('closeUploadModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelUpload')?.addEventListener('click', closeModal);
    document.getElementById('uploadModalOverlay')?.addEventListener('click', closeModal);
    
    // Browse button
    document.getElementById('browseBtn')?.addEventListener('click', function() {
        csvFileInput?.click();
    });
    
    // File selection
    csvFileInput?.addEventListener('change', function() {
        if (this.files.length > 0) {
            selectedFileName.textContent = `Selected: ${this.files[0].name}`;
            selectedFileName.classList.remove('hidden');
            submitUpload.disabled = false;
        }
    });
    
    // Drag and drop
    dropZone?.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('border-sea-green-500');
    });
    
    dropZone?.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('border-sea-green-500');
    });
    
    dropZone?.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('border-sea-green-500');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.csv')) {
            csvFileInput.files = files;
            selectedFileName.textContent = `Selected: ${files[0].name}`;
            selectedFileName.classList.remove('hidden');
            submitUpload.disabled = false;
        } else {
            showToast('Error', 'Please upload a CSV file', 'error');
        }
    });
    
    // Upload form submission
    uploadForm?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const file = csvFileInput.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            submitUpload.disabled = true;
            submitUpload.textContent = 'Uploading...';
            
            const response = await fetch('/api/upload/csv/', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('Success', `Uploaded ${result.total_processed} risks successfully!`, 'success');
                closeModal();
                await refreshAllData();
            } else {
                showToast('Error', result.error || result.message, 'error');
            }
        } catch (error) {
            showToast('Error', 'Failed to upload file', 'error');
        } finally {
            submitUpload.disabled = false;
            submitUpload.textContent = 'Upload & Process';
        }
    });
    
    // ============================================
    // Reports Dropdown Handler
    // ============================================
    const reportsBtn = document.getElementById('reportsBtn');
    const reportsMenu = document.getElementById('reportsMenu');
    
    reportsBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        reportsMenu?.classList.toggle('hidden');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!document.getElementById('reportsDropdown')?.contains(e.target)) {
            reportsMenu?.classList.add('hidden');
        }
    });
    
    // ============================================
    // Search and Filter Handlers
    // ============================================
    
    // Search input with debounce
    let searchTimeout;
    document.getElementById('searchInput')?.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.filters.search = e.target.value;
            fetchRisks(1);
        }, 300);
    });
    
    // Filter dropdowns
    document.getElementById('statusFilter')?.addEventListener('change', function(e) {
        state.filters.status = e.target.value;
        e.target.classList.toggle('filter-active', !!e.target.value);
        fetchRisks(1);
    });
    
    document.getElementById('categoryFilter')?.addEventListener('change', function(e) {
        state.filters.category = e.target.value;
        e.target.classList.toggle('filter-active', !!e.target.value);
        fetchRisks(1);
    });
    
    document.getElementById('ownerFilter')?.addEventListener('change', function(e) {
        state.filters.owner = e.target.value;
        e.target.classList.toggle('filter-active', !!e.target.value);
        fetchRisks(1);
    });
    
    document.getElementById('mitigationFilter')?.addEventListener('change', function(e) {
        state.filters.is_mitigated = e.target.value;
        e.target.classList.toggle('filter-active', !!e.target.value);
        fetchRisks(1);
    });
    
    // Clear filters button
    document.getElementById('clearFilters')?.addEventListener('click', function() {
        state.filters = {
            status: '',
            category: '',
            owner: '',
            is_mitigated: '',
            search: '',
            sort_by: '-risk_score'
        };
        state.matrixFilter = null;
        
        // Reset form elements
        document.getElementById('searchInput').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('ownerFilter').value = '';
        document.getElementById('mitigationFilter').value = '';
        
        // Remove active filter classes
        document.querySelectorAll('.filter-active').forEach(el => {
            el.classList.remove('filter-active');
        });
        
        fetchRisks(1);
    });
    
    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', function() {
        if (state.currentPage > 1) {
            fetchRisks(state.currentPage - 1);
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', function() {
        if (state.currentPage < state.totalPages) {
            fetchRisks(state.currentPage + 1);
        }
    });
    
    // Sort headers
    document.querySelectorAll('[data-sort]').forEach(header => {
        header.addEventListener('click', function() {
            const field = this.dataset.sort;
            if (state.filters.sort_by === field) {
                state.filters.sort_by = field.startsWith('-') ? field.substring(1) : `-${field}`;
            } else {
                state.filters.sort_by = field;
            }
            fetchRisks(1);
        });
    });
    
    // Select all checkbox
    document.getElementById('selectAll')?.addEventListener('change', function(e) {
        const checkboxes = document.querySelectorAll('.mitigation-checkbox');
        checkboxes.forEach(cb => {
            if (cb.checked !== e.target.checked) {
                cb.checked = e.target.checked;
                // Note: This would trigger multiple API calls, consider batching
            }
        });
    });
});

// Export functions for use in other modules
window.RiskDashboard = {
    fetchStats,
    fetchRisks,
    toggleMitigation,
    syncFromCSV,
    syncFromSheets,
    refreshAllData,
    showToast,
    state
};

