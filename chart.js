/* ============================================================
   NFL Monte Carlo Matchup Simulator
   chart.js — Read-Only Visualization Consumer

   Authority:
   - Master Spec Sections V, Z, AE
   - Architecture Overview
   ============================================================ */

/* ============================================================
   INTERNAL STATE (VISUAL ONLY)
   ============================================================ */

let distributionChart = null;


/* ============================================================
   EVENT LISTENERS (SIMULATION LIFECYCLE)
   ============================================================ */

/**
 * Simulation complete → render charts from immutable results
 * Section V.3 / AE.3.3
 */
document.addEventListener("simulationComplete", () => {
    renderDistributionChart(simulationResults);
});

/**
 * Reset → destroy charts and clear canvases
 * Section V.6
 */
document.addEventListener("simulationReset", () => {
    destroyCharts();
});


/* ============================================================
   STRENGTH DIFFERENTIAL DISTRIBUTION
   Section 6.3.4 / Section V
   ============================================================ */

function buildHistogram(data, binCount = 30) {
    const values = data.map(d => d.differential);

    const min = Math.min(...values);
    const max = Math.max(...values);

    //Guard: zero-variance distribution
    if (min === max) {
        return [{
            x0: min,
            x1: max,
            count: values.length
        }];
    }
    
    const binSize = (max - min) / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
        x0: min + i * binSize,
        x1: min + (i + 1) * binSize,
        count: 0
    }));

    values.forEach(v => {
        const rawIdx = Math.floor((v - min) / binSize);

        const idx = Math.max(
            0,
            Math.min(rawIdx, bins.length - 1)
        );
        
        bins[idx].count++;

    });

    return bins;
}

function findZeroBinIndex(bins) {
    return bins.findIndex(
        b => b.x0 <= 0 && b.x1 >= 0
    );
}


function renderDistributionChart(simulationResults) {
    if (!Array.isArray(simulationResults) || simulationResults.length === 0) {
        console.warn("Distribution chart skipped: no simulation data");
        return;
    }

    const canvas = document.getElementById("strength-distribution-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const bins = buildHistogram(simulationResults);

    const zeroBinIndex = findZeroBinIndex(bins);

    const labels = bins.map(b => b.x0.toFixed(2));
    const counts = bins.map(b => b.count);

    if (distributionChart) {
        distributionChart.destroy();
    }

    distributionChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Strength Differential Distribution",
                    data: counts,
                    borderWidth: 1
                },
                {
                    // Zero-line marker (visual only)
                    label: "Parity (0)",
                    data: counts.map((_, i) =>
                        i === zeroBinIndex ? Math.max(...counts) : null
                    ),
                    type: "line",
                    borderColor: "rgba(200, 0, 0, 0.8)",
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]

        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Strength Differential (Team A − Team B)"
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Frequency"
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    labels: {
                        filter: item => item.text !== undefined
                    }
                }
            }

        }
    });
}





/* ============================================================
   CLEANUP
   ============================================================ */

function destroyCharts() {
    if (distributionChart) {
        distributionChart.destroy();
        distributionChart = null;
    }
}
