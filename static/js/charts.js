/**
 * Risk Management Dashboard - Charts Module
 * Creates and updates Chart.js visualizations
 */

// Chart instances
let categoryChart = null;
let statusChart = null;
let ownerChart = null;
let effectivenessChart = null;

// Color palette
const COLORS = {
    seaGreen: {
        primary: 'rgba(20, 184, 166, 1)',
        light: 'rgba(94, 234, 212, 1)',
        dark: 'rgba(13, 148, 136, 1)',
        bg: 'rgba(20, 184, 166, 0.2)'
    },
    categories: [
        'rgba(20, 184, 166, 0.8)',   // Sea green
        'rgba(59, 130, 246, 0.8)',   // Blue
        'rgba(168, 85, 247, 0.8)',   // Purple
        'rgba(249, 115, 22, 0.8)',   // Orange
        'rgba(236, 72, 153, 0.8)',   // Pink
    ],
    statuses: {
        'Open': 'rgba(251, 191, 36, 0.8)',     // Amber
        'Mitigated': 'rgba(20, 184, 166, 0.8)', // Sea green
        'Closed': 'rgba(34, 197, 94, 0.8)',     // Green
        'Accepted': 'rgba(168, 85, 247, 0.8)'   // Purple
    },
    effectiveness: {
        'High': 'rgba(34, 197, 94, 0.8)',      // Green
        'Medium': 'rgba(251, 191, 36, 0.8)',   // Amber
        'Low': 'rgba(239, 68, 68, 0.8)'        // Red
    }
};

// Default chart options
const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                color: '#9ca3af',
                padding: 15,
                font: {
                    family: 'Inter',
                    size: 11
                },
                usePointStyle: true,
                pointStyle: 'circle'
            }
        },
        tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: {
                family: 'Inter',
                size: 13,
                weight: '600'
            },
            bodyFont: {
                family: 'Inter',
                size: 12
            }
        }
    }
};

/**
 * Fetch chart data and initialize all charts
 */
async function fetchChartData() {
    try {
        const [categories, statuses, owners, effectiveness] = await Promise.all([
            fetch('/api/stats/categories/').then(r => r.json()),
            fetch('/api/stats/status/').then(r => r.json()),
            fetch('/api/stats/owners/').then(r => r.json()),
            fetch('/api/stats/effectiveness/').then(r => r.json())
        ]);
        
        initCategoryChart(categories);
        initStatusChart(statuses);
        initOwnerChart(owners);
        initEffectivenessChart(effectiveness);
        
    } catch (error) {
        console.error('Error fetching chart data:', error);
    }
}

/**
 * Initialize Category Distribution Chart (Doughnut)
 */
function initCategoryChart(data) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    const labels = data.map(d => d.risk_category);
    const values = data.map(d => d.count);
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: COLORS.categories,
                borderColor: '#1e293b',
                borderWidth: 3,
                hoverBorderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            ...defaultOptions,
            cutout: '65%',
            plugins: {
                ...defaultOptions.plugins,
                legend: {
                    ...defaultOptions.plugins.legend,
                    position: 'right'
                },
                tooltip: {
                    ...defaultOptions.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Initialize Status Distribution Chart (Bar)
 */
function initStatusChart(data) {
    const ctx = document.getElementById('statusChart')?.getContext('2d');
    if (!ctx) return;
    
    if (statusChart) {
        statusChart.destroy();
    }
    
    const labels = data.map(d => d.status);
    const values = data.map(d => d.count);
    const colors = labels.map(label => COLORS.statuses[label] || COLORS.categories[0]);
    
    statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Risks',
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 40
            }]
        },
        options: {
            ...defaultOptions,
            indexAxis: 'x',
            plugins: {
                ...defaultOptions.plugins,
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(51, 65, 85, 0.3)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Inter',
                            size: 11
                        },
                        stepSize: 5
                    }
                }
            }
        }
    });
}

/**
 * Initialize Owner Distribution Chart (Horizontal Bar)
 */
function initOwnerChart(data) {
    const ctx = document.getElementById('ownerChart')?.getContext('2d');
    if (!ctx) return;
    
    if (ownerChart) {
        ownerChart.destroy();
    }
    
    const labels = data.map(d => d.risk_owner);
    const values = data.map(d => d.count);
    
    ownerChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Risks',
                data: values,
                backgroundColor: COLORS.categories,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 20
            }]
        },
        options: {
            ...defaultOptions,
            indexAxis: 'y',
            plugins: {
                ...defaultOptions.plugins,
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(51, 65, 85, 0.3)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

/**
 * Initialize Control Effectiveness Chart (Pie)
 */
function initEffectivenessChart(data) {
    const ctx = document.getElementById('effectivenessChart')?.getContext('2d');
    if (!ctx) return;
    
    if (effectivenessChart) {
        effectivenessChart.destroy();
    }
    
    const labels = data.map(d => d.control_effectiveness);
    const values = data.map(d => d.count);
    const colors = labels.map(label => COLORS.effectiveness[label] || COLORS.categories[0]);
    
    effectivenessChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: '#1e293b',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            ...defaultOptions,
            plugins: {
                ...defaultOptions.plugins,
                tooltip: {
                    ...defaultOptions.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update all charts with new data
 */
async function updateCharts() {
    await fetchChartData();
}

// Make functions available globally
window.fetchChartData = fetchChartData;
window.updateCharts = updateCharts;
