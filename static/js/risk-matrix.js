/**
 * Risk Management Dashboard - Risk Matrix Module
 * Creates and manages the interactive 5x5 Risk Matrix
 */

// Risk Matrix configuration
const MATRIX_CONFIG = {
    likelihoods: [5, 4, 3, 2, 1],  // Top to bottom
    impacts: [1, 2, 3, 4, 5],      // Left to right
    labels: {
        likelihood: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'],
        impact: ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe']
    }
};

// Matrix data storage
let matrixData = {};

/**
 * Get risk level based on score
 */
function getRiskLevel(score) {
    if (score >= 15) return 'critical';
    if (score >= 8) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
}

/**
 * Fetch matrix data from API
 */
async function fetchMatrixData() {
    try {
        const response = await fetch('/api/stats/matrix/');
        matrixData = await response.json();
        renderRiskMatrix();
    } catch (error) {
        console.error('Error fetching matrix data:', error);
    }
}

/**
 * Render the risk matrix
 */
function renderRiskMatrix() {
    const container = document.getElementById('riskMatrix');
    if (!container) return;
    
    let html = `
        <div class="flex items-stretch">
            <!-- Likelihood Label (Vertical) -->
            <div class="flex items-center justify-center pr-2" style="writing-mode: vertical-lr; transform: rotate(180deg);">
                <span class="text-sm font-semibold text-sea-green-400 tracking-wider">LIKELIHOOD</span>
            </div>
            
            <!-- Matrix Container -->
            <div class="flex flex-col flex-1">
                <!-- Impact Label (Top) -->
                <div class="text-center mb-2">
                    <span class="text-sm font-semibold text-sea-green-400 tracking-wider">IMPACT</span>
                </div>
                
                <!-- Matrix Grid -->
                <div class="risk-matrix">
                    <!-- Empty corner cell -->
                    <div class="risk-matrix-header"></div>
                    
                    <!-- Impact headers (1-5) -->
                    ${MATRIX_CONFIG.impacts.map((impact, i) => `
                        <div class="risk-matrix-header" title="${MATRIX_CONFIG.labels.impact[i]}">
                            ${impact}
                        </div>
                    `).join('')}
    `;
    
    // Rows (from high likelihood to low)
    MATRIX_CONFIG.likelihoods.forEach((likelihood, rowIndex) => {
        // Likelihood label
        html += `
            <div class="risk-matrix-label" title="${MATRIX_CONFIG.labels.likelihood[4 - rowIndex]}">
                ${likelihood}
            </div>
        `;
        
        // Cells
        MATRIX_CONFIG.impacts.forEach(impact => {
            const key = `${likelihood}_${impact}`;
            const cellData = matrixData[key] || { count: 0, score: likelihood * impact };
            const score = cellData.score;
            const count = cellData.count;
            const level = getRiskLevel(score);
            
            html += `
                <div class="risk-matrix-cell risk-${level}"
                     data-likelihood="${likelihood}"
                     data-impact="${impact}"
                     data-score="${score}"
                     data-count="${count}"
                     data-tooltip="L:${likelihood} × I:${impact} = ${score}"
                     onclick="filterByMatrixCell(${likelihood}, ${impact}, ${score})">
                    ${count > 0 ? count : ''}
                </div>
            `;
        });
    });
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Filter risks by matrix cell
 */
function filterByMatrixCell(likelihood, impact, score) {
    const state = window.RiskDashboard?.state;
    if (!state) return;
    
    // Toggle filter - if same cell clicked again, clear filter
    if (state.matrixFilter?.likelihood === likelihood && state.matrixFilter?.impact === impact) {
        state.matrixFilter = null;
        highlightMatrixCell(null);
    } else {
        state.matrixFilter = { likelihood, impact, score };
        highlightMatrixCell(likelihood, impact);
    }
    
    // Fetch filtered risks
    window.RiskDashboard.fetchRisks(1);
    
    // Show toast
    if (state.matrixFilter) {
        window.RiskDashboard.showToast(
            'Filter Applied',
            `Showing risks with score: ${score} (L:${likelihood} × I:${impact})`,
            'info'
        );
    } else {
        window.RiskDashboard.showToast(
            'Filter Cleared',
            'Showing all risks',
            'info'
        );
    }
}

/**
 * Highlight selected matrix cell
 */
function highlightMatrixCell(likelihood, impact) {
    // Remove existing highlights
    document.querySelectorAll('.risk-matrix-cell').forEach(cell => {
        cell.style.outline = 'none';
        cell.style.outlineOffset = '0';
    });
    
    // Add highlight to selected cell
    if (likelihood && impact) {
        const cell = document.querySelector(
            `.risk-matrix-cell[data-likelihood="${likelihood}"][data-impact="${impact}"]`
        );
        if (cell) {
            cell.style.outline = '3px solid white';
            cell.style.outlineOffset = '2px';
        }
    }
}

/**
 * Get matrix summary statistics
 */
function getMatrixSummary() {
    let critical = 0, high = 0, medium = 0, low = 0;
    
    Object.values(matrixData).forEach(cell => {
        const level = getRiskLevel(cell.score);
        switch (level) {
            case 'critical': critical += cell.count; break;
            case 'high': high += cell.count; break;
            case 'medium': medium += cell.count; break;
            case 'low': low += cell.count; break;
        }
    });
    
    return { critical, high, medium, low };
}

// Make functions available globally
window.fetchMatrixData = fetchMatrixData;
window.filterByMatrixCell = filterByMatrixCell;
window.getMatrixSummary = getMatrixSummary;
