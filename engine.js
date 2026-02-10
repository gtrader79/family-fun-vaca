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

    // 2. Get MatchUps on each metric.  noise = 0 for true baseline or 1 to allow for noise
    getMatchUpDelta: function(tA, tB, noise=0) {
        const bm_f = SIM_CONFIG.boxMuller_Factor;
        //Passing Volume
        const passAdv = (Utils.getZ(tA.off_pass_yards_per_game, App.data.leagueMetrics.offPass) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_pass_yards_allowed_per_game, App.data.leagueMetrics.defPass, true) + (noise * Utils.boxMuller() * bm_f))

        const qbAdv = (Utils.getZ(tA.off_passer_rating, App.data.leagueMetrics.offQb) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_passer_rating_allowed, App.data.leagueMetrics.defQb, true) + (noise * Utils.boxMuller() * bm_f))

        const teAdv = (Utils.getZ(tA.off_te_yards_per_game, App.data.leagueMetrics.offTE) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_te_yards_allowed_per_game, App.data.leagueMetrics.defTE, true) + (noise * Utils.boxMuller() * bm_f))
        
        const wrAdv = (Utils.getZ(tA.off_wr_yards_per_game, App.data.leagueMetrics.offWR) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_wr_yards_allowed_per_game, App.data.leagueMetrics.defWR, true) + (noise * Utils.boxMuller() * bm_f))

        //Russing Volume
        const rushAdv = (Utils.getZ(tA.off_rush_yards_per_game, App.data.leagueMetrics.offRush) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_rush_yards_allowed_per_game, App.data.leagueMetrics.defRush, true) + (noise * Utils.boxMuller() * bm_f))

        //Pressure (Offense wants low, Defense wants High)
        const pressureAdv = (Utils.getZ(tA.off_pressure_allowed_pct, App.data.leagueMetrics.offPressure, true) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_pressure_generated_pct, App.data.leagueMetrics.defPressure) + (noise * Utils.boxMuller() * bm_f))

        //Conversion
        
        
        //Turnovers

        
        //Red Zone & Explosive Plays
        const redZoneAdv = (Utils.getZ(tA.off_rz_efficiency_pct, App.data.leagueMetrics.offRZ) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_rz_efficiency_allowed_pct, App.data.leagueMetrics.defRZ, true) + (noise * Utils.boxMuller() * bm_f))
        
        const explosivePlayAdv = (Utils.getZ(tA.off_explosive_play_rate_pct, App.data.leagueMetrics.offExplosivePlay) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_explosive_play_rate_allowed_pct, App.data.leagueMetrics.defExplosivePlay, true) + (noise * Utils.boxMuller() * bm_f))

        
        //Special Teams
        

        const rawDelta = (passAdv * SIM_CONFIG.weights.passVolume)
            + (qbAdv * SIM_CONFIG.weights.qb)
            + (teAdv * SIM_CONFIG.weights.wr)
            + (wrAdv * SIM_CONFIG.weights.te)
            + (rushAdv * SIM_CONFIG.weights.rush) 
            + (pressureAdv * SIM_CONFIG.weights.pressure)
            + (redZoneAdv * SIM_CONFIG.weights.redZone) 
            + (explosivePlayAdv * SIM_CONFIG.weights.explosive) 
            
        ;


        let finalDelta = rawDelta / App.simulation.normalizationFactor;
    },




    
    
    // 3. Run the Monte Carlo Simulation
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
