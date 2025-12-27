/* ============================================================
   NFL Monte Carlo Matchup Simulator
   chart.js — Read-Only Visualization Consumer

   Authority:
   - Master Spec Sections V, Z, AE
   - Architecture Overview
   - Roadmap Phase 4.0
   ============================================================ */

Chart.register(window["chartjs-plugin-annotation"]);

/* ============================================================
   INTERNAL STATE (VISUAL ONLY)
   ============================================================ */

let distributionChart = null;

/* ============================================================
   DISTRIBUTION VIEW MODE
   Roadmap Phase 4.0
   ============================================================ */

const DISTRIBUTION_VIEW_MODES = {
    SINGLE: "single",
    SPLIT: "split"
};

let distributionViewMode = DISTRIBUTION_VIEW_MODES.SINGLE;

/* ============================================================
   EVENT LISTENERS (SIMULATION LIFECYCLE)
   ============================================================ */

/**
 * Simulation complete → render distribution visualization
 * Section V.3 / AE.3.3
 */
document.addEventListener("simulationComplete", () => {
    renderDistributionChart(simulationResults);
});

/**
 * Simulation reset → destroy visualization
 * Section V.6
 */
document.addEventListener("simulationReset", destroyCharts);

/**
 * Distribution mode toggle (Single KDE ↔ Split KDE)
 * Phase 4.0
 */
document.addEventListener("change", e => {
    if (e.target.name !== "distributionMode") return;

    distributionViewMode = e.target.value;

    if (Array.isArray(simulationResults) && simulationResults.length > 0) {
        renderDistributionChart(simulationResults);
    }
});

/* ============================================================
   HISTOGRAM + KDE HELPERS
   Section 6.3.4 / Section V
   ============================================================ */

function buildHistogram(data, binCount = 30) {
    const values = data.map(d => d.differential);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
        return [{ x0: min, x1: max, count: values.length }];
    }

    const binSize = (max - min) / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
        x0: min + i * binSize,
        x1: min + (i + 1) * binSize,
        count: 0
    }));

    values.forEach(v => {
        const idx = Math.max(
            0,
            Math.min(Math.floor((v - min) / binSize), bins.length - 1)
        );
        bins[idx].count++;
    });

    return bins;
}

function findZeroBinIndex(bins) {
    return bins.findIndex(b => b.x0 <= 0 && b.x1 >= 0);
}

function gaussianKernel(u) {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
}

function computeMean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeBandwidth(values) {
    const mean = computeMean(values);
    const variance = computeMean(values.map(v => (v - mean) ** 2));
    const stdDev = Math.sqrt(variance);
    return 1.06 * stdDev * Math.pow(values.length, -1 / 5);
}

function computeKDE(xValues, sampleValues, bandwidth) {
    return xValues.map(x =>
        sampleValues.reduce(
            (sum, v) => sum + gaussianKernel((x - v) / bandwidth),
            0
        ) / (sampleValues.length * bandwidth)
    );
}

/* ============================================================
   DISTRIBUTION RENDERER
   Phase 4.0
   ============================================================ */

function renderDistributionChart(simulationResults) {
    if (!Array.isArray(simulationResults) || simulationResults.length === 0) {
        return;
    }

    const canvas = document.getElementById("strength-distribution-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const bins = buildHistogram(simulationResults);

    const labels = bins.map(b => b.x0.toFixed(2));
    const counts = bins.map(b => b.count);
    const maxHist = Math.max(...counts);

    const zeroBinIndex = findZeroBinIndex(bins);

    const barColors = bins.map((_, i) =>
        i < zeroBinIndex
            ? "rgba(120,160,220,0.75)"   // Team B favored
            : "rgba(220,120,120,0.75)"   // Team A favored
    );

    const binMidpoints = bins.map(b => (b.x0 + b.x1) / 2);

    const teamAValues = simulationResults
        .filter(d => d.winner === "A")
        .map(d => d.differential);

    const teamBValues = simulationResults
        .filter(d => d.winner === "B")
        .map(d => d.differential);

    const kdeA = teamAValues.length > 1
        ? computeKDE(binMidpoints, teamAValues, computeBandwidth(teamAValues))
        : binMidpoints.map(() => 0);

    const kdeB = teamBValues.length > 1
        ? computeKDE(binMidpoints, teamBValues, computeBandwidth(teamBValues))
        : binMidpoints.map(() => 0);

    const scaledKDEA = kdeA.map(v => (v / Math.max(...kdeA || [1])) * maxHist);
    const scaledKDEB = kdeB.map(v => (v / Math.max(...kdeB || [1])) * maxHist);

    if (distributionChart) distributionChart.destroy();

    const datasets = [];

    if (distributionViewMode === DISTRIBUTION_VIEW_MODES.SINGLE) {
        datasets.push({
            label: "Strength Differential Distribution",
            data: counts,
            backgroundColor: barColors,
            borderWidth: 1
        });

        datasets.push({
            label: "Overall KDE",
            data: scaledKDEA.map((v, i) => v + (scaledKDEB[i] || 0)),

            type: "line",
            borderColor: "rgba(60,60,60,0.9)",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35
        });
    }

    if (distributionViewMode === DISTRIBUTION_VIEW_MODES.SPLIT) {
        datasets.push({
            label: "Team A Win Density",
            data: scaledKDEA,
            type: "line",
            borderColor: "rgba(60,120,220,0.9)",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35
        });

        datasets.push({
            label: "Team B Win Density",
            data: scaledKDEB,
            type: "line",
            borderColor: "rgba(220,90,90,0.9)",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35
        });
    }

    distributionChart = new Chart(ctx, {
        type: "bar",
        data: { labels, datasets },
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
                annotation:
                    distributionViewMode === DISTRIBUTION_VIEW_MODES.SINGLE
                        ? {
                            annotations: {
                                parity: {
                                    type: "line",
                                    scaleID: "x",
                                    value: zeroBinIndex,
                                    borderColor: "rgba(200,0,0,0.9)",
                                    borderWidth: 2,
                                    label: {
                                        display: true,
                                        content: "Parity (0)"
                                    }
                                }
                            }
                        }
                        : {}
            }
        }
    });

    renderDistributionSummary(
        computeMean(simulationResults.map(d => d.differential)),
        null,
        teamAValues,
        teamBValues
    );
}

/* ============================================================
   SUMMARY (INFORMATIONAL ONLY)
   ============================================================ */

function renderDistributionSummary(mean, _, teamAValues, teamBValues) {
    const el = document.getElementById("distribution-summary");
    if (!el) return;

    const favored =
        mean > 0 ? "Team A" :
        mean < 0 ? "Team B" :
        "Neither team";

    el.innerHTML = `
        <strong>Interpretation</strong><br/>
        ${favored} is favored on average based on simulated outcomes.<br/>
        Mean differential: <strong>${mean.toFixed(3)}</strong><br/><br/>
        <strong>Win Probability</strong><br/>
        Team A: ${(teamAValues.length / simulationResults.length * 100).toFixed(1)}%<br/>
        Team B: ${(teamBValues.length / simulationResults.length * 100).toFixed(1)}%
    `;
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
