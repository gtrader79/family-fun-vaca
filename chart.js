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

function buildHistogram(data, binCount = 30) {
    const values = data.map(d => d.differential);

    const min = Math.min(...values);
    const max = Math.max(...values);

    const binSize = (max - min) / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
        x0: min + i * binSize,
        x1: min + (i + 1) * binSize,
        count: 0
    }));

    values.forEach(v => {
        const idx = Math.min(
            Math.floor((v - min) / binSize),
            binCount - 1
        );
        bins[idx].count++;
    });

    return bins;
}


let distributionChart = null;

function renderDistributionChart(simulationResults) {
    const ctx = document
        .getElementById("strength-distribution-canvas")
        .getContext("2d");

    const bins = buildHistogram(simulationResults);

    const labels = bins.map(
        b => b.x0.toFixed(2)
    );

    const counts = bins.map(
        b => b.count
    );

    if (distributionChart) {
        distributionChart.destroy();
    }

    distributionChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Strength Differential Distribution",
                data: counts,
                borderWidth: 1
            }]
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
