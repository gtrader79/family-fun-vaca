/* ============================================================
   NFL Monte Carlo Matchup Simulator
   chart.js — Read-Only Visualization Consumer

   Authority:
   - Master Spec Sections V, Z, AE
   - Architecture Overview
   ============================================================ */

Chart.register(window['chartjs-plugin-annotation']);


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


function computeMean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

function findBinIndexForValue(bins, value) {
    return bins.findIndex(b => b.x0 <= value && b.x1 >= value);
}

function gaussianKernel(u) {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
}

function computeBandwidth(values) {
    // Silverman's rule of thumb
    const mean = computeMean(values);
    const variance =
        computeMean(values.map(v => (v - mean) ** 2));
    const stdDev = Math.sqrt(variance);

    return 1.06 * stdDev * Math.pow(values.length, -1 / 5);
}

function computeKDE(xValues, sampleValues, bandwidth) {
    return xValues.map(x => {
        let sum = 0;
        for (const v of sampleValues) {
            sum += gaussianKernel((x - v) / bandwidth);
        }
        return sum / (sampleValues.length * bandwidth);
    });
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

    const differentials = simulationResults.map(d => d.differential);
    
    const mean = computeMean(differentials);
    const median = computeMedian(differentials);
    
    const meanBinIndex = Math.max(
            0,
            Math.min(
                findBinIndexForValue(bins, mean),
                bins.length - 1
            )
        );
        
        const medianBinIndex = Math.max(
            0,
            Math.min(
                findBinIndexForValue(bins, median),
                bins.length - 1
            )
        );

    
    const zeroBinIndex = findZeroBinIndex(bins);

    const labels = bins.map(b => b.x0.toFixed(2));
    const counts = bins.map(b => b.count);

    const maxCount = Math.max(...counts);

    const teamAValues = simulationResults
        .filter(d => d.winner === "A")
        .map(d => d.differential);
    
    const teamBValues = simulationResults
        .filter(d => d.winner === "B")
        .map(d => d.differential);

    
    
    // KDE computation
        // X-axis values = bin midpoints    
        const binMidpoints = bins.map(b => (b.x0 + b.x1) / 2);

        // Bandwidths (computed independently)
        const bandwidthA = teamAValues.length > 1
            ? computeBandwidth(teamAValues)
            : null;
        
        const bandwidthB = teamBValues.length > 1
            ? computeBandwidth(teamBValues)
            : null;
        
        // KDEs
        const kdeA = bandwidthA
            ? computeKDE(binMidpoints, teamAValues, bandwidthA)
            : binMidpoints.map(() => 0);
        
        const kdeB = bandwidthB
            ? computeKDE(binMidpoints, teamBValues, bandwidthB)
            : binMidpoints.map(() => 0);

    
    // Scale KDE to histogram height
        
        const maxHist = Math.max(...counts);
        
                
        const maxKDEA = Math.max(...kdeA);
        const maxKDEB = Math.max(...kdeB);
        
        const scaledKDEA = maxKDEA > 0
            ? kdeA.map(v => (v / maxKDEA) * maxHist)
            : kdeA;
        
        const scaledKDEB = maxKDEB > 0
            ? kdeB.map(v => (v / maxKDEB) * maxHist)
            : kdeB;
    

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
                        i === zeroBinIndex ? maxCount : null
                    ),
                    type: "line",
                    borderColor: "rgba(200, 0, 0, 0.85)",
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }, 
                {
                    label: "Team A Win Density",
                    data: scaledKDEA,
                    type: "line",
                    borderColor: "rgba(60, 120, 220, 0.85)",
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.35
                },
                {
                    label: "Team B Win Density",
                    data: scaledKDEB,
                    type: "line",
                    borderColor: "rgba(220, 90, 90, 0.85)",
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.35
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
                annotation: {
                    annotations: {
                        zeroLine: {
                            type: "line",
                            scaleID: "x",
                            value: bins.findIndex(b => b.x0 <= 0 && b.x1 >= 0),
                            borderColor: "rgba(200, 0, 0, 0.9)",
                            borderWidth: 2,
                            label: {
                                display: true,
                                content: "Parity (0)",
                                position: "start"
                            }
                        },
            
                        meanLine: {
                            type: "line",
                            scaleID: "x",
                            value: meanBinIndex,
                            borderColor: "rgba(0, 90, 200, 0.9)",
                            borderWidth: 2,
                            label: {
                                display: true,
                                content: `Mean (${mean.toFixed(2)})`,
                                position: "start"
                            }
                        },
            
                        medianLine: {
                            type: "line",
                            scaleID: "x",
                            value: medianBinIndex,
                            borderColor: "rgba(0, 140, 90, 0.9)",
                            borderWidth: 2,
                            borderDash: [6, 4],
                            drawTime: "afterDatasetsDraw",
                            label: {
                                display: true,
                                content: `Median (${median.toFixed(2)})`,
                                position: "start"
                            }
                        }
                    }
                },
                legend: {
                    display: true
                }
            }


        }
    });

    renderDistributionSummary(mean, median, teamAValues, teamBValues);

    
}



function renderDistributionSummary(mean, median, teamAValues, teamBValues) {
    const el = document.getElementById("distribution-summary");
    if (!el) return;

    let favored;
    if (mean > 0) favored = "Team A";
    else if (mean < 0) favored = "Team B";
    else favored = "Neither team";

    const winRates = {
        teamA: teamAValues.length / simulationResults.length,
        teamB: teamBValues.length / simulationResults.length
    };
    
    el.innerHTML = `
        <strong>Interpretation</strong><br/>
        ${favored} is favored on average based on simulated strength differentials.<br/>
        Mean differential: <strong>${mean.toFixed(3)}</strong><br/>
        Median differential: <strong>${median.toFixed(3)}</strong><br/>
        
    `;

    el.innerHTML += `
        <br/><strong>Win Probability</strong><br/>
        Team A: ${(winRates.teamA * 100).toFixed(1)}%<br/>
        Team B: ${(winRates.teamB * 100).toFixed(1)}%
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
