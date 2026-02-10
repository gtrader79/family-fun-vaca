/* engine.js 
    The logic for the site:  Results stored in App.simulation
*/

const Engine = {

    // 1. Apply Injuries to Stats
    // Replaces getAdjustedTeamStats from injuryMapping.js
    getAdjustedStats: function(team, injuries) {
        // Clone the stats to avoid mutating original data
        let stats = { ...team.stats }; 
        
        // Iterate through defined injury maps
        for (let [pos, mapData] of Object.entries(INJURY_MAP)) {
            const injuryLevel = injuries[pos] || 0; // 0, 1, or 2
            if (injuryLevel === 0) continue; // Healthy, skip

            // Apply multipliers
            for (let [statKey, multipliers] of Object.entries(mapData)) {
                if (stats[statKey] !== undefined) {
                    // multipliers array matches [Healthy, Ques, Out]
                    stats[statKey] *= multipliers[injuryLevel];
                }
            }
        }
        return stats;
    },

    // 2. Run the Monte Carlo Simulation
    run: function(teamA, teamB, factors) {
        console.time("Simulation Run"); // Debug timer

        // A. Adjust Stats for Injuries
        const statsA = this.getAdjustedStats(teamA, factors.injuriesA);
        const statsB = this.getAdjustedStats(teamB, factors.injuriesB);

        // B. Setup Variables
        const config = SIM_CONFIG;
        const weights = config.weights;
        const sigma = App.simulation.normalizationFactor || 1.0;
        
        // Reset Results
        App.simulation.results = [];
        App.simulation.runs = [];

        // C. Calculate Static Factors (do this OUTSIDE the loop)
        // (Simplified logic for brevity - mimics your getSituationalFactors)
        let staticDelta = 0;
        
        // HFA
        if (factors.context.hfa === 'teamA') staticDelta += config.hfa_base;
        else if (factors.context.hfa === 'teamB') staticDelta -= config.hfa_base;

        // Travel
        if (factors.context.travel === 'teamA_travel') staticDelta -= config.travel_penalty;
        if (factors.context.travel === 'teamB_travel') staticDelta += config.travel_penalty;

        // D. Monte Carlo Loop
        for (let i = 0; i < config.iterations; i++) {
            let runDelta = staticDelta;

            // Iterate over weighted categories
            for (let key in weights) {
                // Get base stats
                let valA = statsA[key] || 0;
                let valB = statsB[key] || 0;
                
                // Add Noise (Box-Muller)
                // We add randomness to the PERFORMANCE of the stat                    
                let perfA = valA + (Utils.boxMuller() * 0.1); // 10% variance
                let perfB = valB + (Utils.boxMuller() * 0.1);                    
                
                // Compare
                let diff = perfA - perfB;
                runDelta += diff * weights[key];
            }

            // Normalize
            let zScore = runDelta / sigma;
            let probA = Utils.sigmoid(zScore, config.k);
            
            // Store Raw Delta
            App.simulation.results.push(runDelta);
            
            // Store Detailed Run (Optimized: Only store what Visuals.js needs)
            App.simulation.runs.push({
                teamA_Prob: probA,
                teamB_Prob: 1 - probA,
                // Synthetic score generation for display
                teamA_Score: Math.round(24 + (runDelta * 10)), 
                teamB_Score: Math.round(24 - (runDelta * 10)),
                runDelta: runDelta
            });
        }

        // E. Calculate Summary Stats
        this.calculateSummary();
        
        console.timeEnd("Simulation Run");
    },

    calculateSummary: function() {
        const results = App.simulation.results;
        const winsA = results.filter(r => r > 0).length;
        const total = results.length;

        App.simulation.summary = {
            winProbA: winsA / total,
            winProbB: 1 - (winsA / total),
            count: total
        };
    }
};
