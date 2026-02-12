/* engine.js 
    The logic for the site:  Results stored in App.simulation
*/

const Engine = {

    // Get MatchUps on each metric.  noise = 0 for true baseline or 1 to allow for noise
    getMatchUpDelta: function(tA, tB, noise=0) {
        const bm_f = SIM_CONFIG.boxMuller_Factor;
        //Passing Volume
        const passAdv = (Utils.getZ(tA.off_pass_yards_per_game, App.data.leagueMetrics.offPass) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_pass_yards_allowed_per_game, App.data.leagueMetrics.defPass, true) + (noise * Utils.boxMuller() * bm_f));

        const qbAdv = (Utils.getZ(tA.off_passer_rating, App.data.leagueMetrics.offQB) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_passer_rating_allowed, App.data.leagueMetrics.defQB, true) + (noise * Utils.boxMuller() * bm_f));

        const teAdv = (Utils.getZ(tA.off_te_yards_per_game, App.data.leagueMetrics.offTE) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_te_yards_allowed_per_game, App.data.leagueMetrics.defTE, true) + (noise * Utils.boxMuller() * bm_f));
        
        const wrAdv = (Utils.getZ(tA.off_wr_yards_per_game, App.data.leagueMetrics.offWR) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_wr_yards_allowed_per_game, App.data.leagueMetrics.defWR, true) + (noise * Utils.boxMuller() * bm_f));

        //Russing Volume
        const rushAdv = (Utils.getZ(tA.off_rush_yards_per_game, App.data.leagueMetrics.offRush) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_rush_yards_allowed_per_game, App.data.leagueMetrics.defRush, true) + (noise * Utils.boxMuller() * bm_f));

        //Pressure (Offense wants low, Defense wants High)
        const pressureAdv = (Utils.getZ(tA.off_pressure_allowed_pct, App.data.leagueMetrics.offPressure, true) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_pressure_generated_pct, App.data.leagueMetrics.defPressure) + (noise * Utils.boxMuller() * bm_f));

        //Conversion
        
        
        //Turnovers

        
        //Red Zone & Explosive Plays
        const redZoneAdv = (Utils.getZ(tA.off_rz_efficiency_pct, App.data.leagueMetrics.offRZ) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_rz_efficiency_allowed_pct, App.data.leagueMetrics.defRZ, true) + (noise * Utils.boxMuller() * bm_f));
        
        const explosivePlayAdv = (Utils.getZ(tA.off_explosive_play_rate_pct, App.data.leagueMetrics.offExplosivePlay) + (noise * Utils.boxMuller() * bm_f))
                    - (Utils.getZ(tB.def_explosive_play_rate_allowed_pct, App.data.leagueMetrics.defExplosivePlay, true) + (noise * Utils.boxMuller() * bm_f));

        
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
        return finalDelta;
    },

    getHomeFieldAdvantage: function () {
        let hfaValue = 0;
        if (App.inputs.factors.context.hfa == 1) hfaValue = SIM_CONFIG.hfa_base;               //Team A Home
        else if (App.inputs.factors.context.hfa == 3) hfaValue = -SIM_CONFIG.hfa_base;         //Team B Home (Negative for A)
        return hfaValue;
    },

    getTravelPenalty: function () {
        let travelPenalty = 0;
        if (App.inputs.factors.context.travel == 1) travelPenalty = -SIM_CONFIG.travel_penalty;  //A is traveling (Penalty to A)
        if (App.inputs.factors.context.travel == 3) travelPenalty =  SIM_CONFIG.travel_penalty;  //B is traveling (Bonus to A)
        return travelPenalty;
    },

    getTotalRestDelta: function () {
        let restImpactA = 0.0;
        if (App.inputs.factors.context.teamA_Rest == 0) restImpactA = -0.05;                    //Team A is tired 
        if (App.inputs.factors.context.teamA_Rest == 2) restImpactA =  0.07;                    //Team A is rested

        let restImpactB = 0.0;
        if (App.inputs.factors.context.teamB_Rest == 0) restImpactB = -0.05;                    //Team B is tired 
        if (App.inputs.factors.context.teamB_Rest == 2) restImpactB =  0.07;                    //Team B is rested

        const totalRestDelta = restImpactA - restImpactB;
        return totalRestDelta;
    },

    getMomentumAdvantage: function () {
        let momentumValue = 0;
        if (App.inputs.factors.context.momentum == 1) momentumValue =  SIM_CONFIG.momentum_val  //A has momentum (Bonus to A)
        if (App.inputs.factors.context.momentum == 3) momentumValue = -SIM_CONFIG.momentum_val  //B has momentum (Negative to A)
        return momentumValue;
    },
    
    getDivisionCompressor: function () {
        const divisionCompressor = App.inputs.factors.context.divisionMatchup ? SIM_CONFIG.division_Factor : 1.0;
        return divisionCompressor;
    },

    getMatchUpCompressor: function () {
        const gameMatchUpValue = App.inputs.factors.context.gameMatchUpType;
        const gameMatchUpCompressor = SIM_CONFIG.matchupMap[gameMatchUpValue];
        return gameMatchUpCompressor;
    },

    storeRun: function (lbl, teamStrengthA, teamStrengthB, factors = 0, compressor=1) {        
        let delta = 0.00;
        delta += (teamStrengthA - teamStrengthB) + factors; 
        delta *= compressor;
        
        const probA = Utils.sigmoid(delta, SIM_CONFIG.k);
        const probB = 1-probA;

            
        App.simulation.runs.push({
            runLabel: lbl,
            teamStrength_A: teamStrengthA,
            teamStrength_B: teamStrengthB,
            delta: delta,
            winProb_A: probA,
            winProb_B: probB,
            
            // Synthetic score generation for display
            teamA_Score: Math.round(24 + (delta * 10)), 
            teamB_Score: Math.round(24 - (delta * 10)),
            adjustmentFactors: factors,
            compressionValue: compressor
            
        });
        
    },



    //Run the Monte Carlo Simulation
    run: function(teamA, teamB, factors) {
        // Reset Results
        App.simulation.results = [];
        App.simulation.runs = [];
        
        //capture base results with no noise or adjustments or injuries
        const baseA = this.getMatchUpDelta(teamA, teamB, 0);
        const baseB = this.getMatchUpDelta(teamB, teamA, 0);
        //const baseDelta = (baseA - baseB);  

        //Store results
        this.storeRun('Baseline with no adjustments', baseA, baseB);

        //One-time capture Context Factor to be added to Delta        
        const contextFactors = this.getHomeFieldAdvantage() + this.getTravelPenalty() + this.getTotalRestDelta() + this.getMomentumAdvantage();
        console.log(`Total Factors: ${contextFactors}`);

        //One-time capture Context Compressor to be multiplied to Delta
        const contextCompressor = this.getDivisionCompressor() * this.getMatchUpCompressor();
        console.log(`Total Compression: ${contextCompressor}`);


        //Base with context factors & compressor
        //const baseDelta_Factors = (baseDelta + contextFactors) * contextCompressor;        
        //Store results
        this.storeRun('Baseline with adjustments', baseA, baseB, contextFactors, contextCompressor);
                
        

        
        for (let i = 0; i < SIM_CONFIG.iterations; i++) {
            //get team strength with slight 'noise' applied to each team stat metric
            //3rd variable is noise.  value = 1 allows boxMuller variance to be adjusted
            const tsA = this.getMatchUpDelta(teamA, teamB, 1);  
            const tsB = this.getMatchUpDelta(teamB, teamA, 1);  
            this.storeRun('Monte Carlo Simulation', tsA, tsB, contextFactors, contextCompressor);
            
        }
    },







    

    
    
    // Apply Injuries to Stats    
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

      
    
    // Run the Monte Carlo Simulation
    run__Bad__Do_NOT_RUN: function(teamA, teamB, factors) {
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
