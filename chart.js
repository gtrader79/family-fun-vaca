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

let strengthDistributionChart = null;


/* ============================================================
   EVENT LISTENERS (SIMULATION LIFECYCLE)
   ============================================================ */

/**
 * Simulation complete → render charts from immutable results
 * Section V.3 / AE.3.3
 */
document.addEventListener("simulationComplete", () => {
    renderStrengthDistribution();
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

/**
 * Renders histogram of (Team A − Team B) realized strength.
 * Reads from app.js aggregate outputs only.
 */
function renderStrengthDistribution() {
    if (
        typeof aggregateResults === "undefined" ||
        !aggregateResults ||
        !Array.isArray(aggregateResults.differentials)
    ) {
        return;
    }

    const canvas = document.getElementById("strength-distribution-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Destroy prior instance if present
    if (strengthDistributionChart) {
        strengthDistributionChart.destroy();
        strengthDistributionChart = null;
    }

    const data = aggregateResults.differentials;

    // Histogram binning (pure visualization concern)
    const BIN_COUNT = 30;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / BIN_COUNT || 1;

    const bins = new Array(BIN_COUNT).fill(0);

    data.forEach(value => {
        const index = Math.min(
            BIN_COUNT - 1,
            Math.floor((value - min) / binWidth)
        );
        bins[index]++;
    });

    const labels = bins.map((_, i) => {
        const start = min + i * binWidth;
        const end = start + binWidth;
        return `${start.toFixed(2)} to ${end.toFixed(2)}`;
    });

    strengthDistributionChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Strength Differential (Team A − Team B)",
                data: bins
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Section V.7 — no animated interpolation
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Strength Differential"
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Run Count"
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true
                }
            }
        }
    });
}


/* ============================================================
   CLEANUP
   ============================================================ */

function destroyCharts() {
    if (strengthDistributionChart) {
        strengthDistributionChart.destroy();
        strengthDistributionChart = null;
    }
}
