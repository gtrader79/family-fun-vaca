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
        const maxKDE = Math.max(...kdeDensity);
        const maxHist = Math.max(...counts);
        
        const scaledKDE = kdeDensity.map(
            d => (d / maxKDE) * maxHist
        );
        
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

    renderDistributionSummary(mean, median);

    
}
