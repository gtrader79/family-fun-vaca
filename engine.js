/* engine.js 
    The logic for the site:  Results stored in App.simulation
*/

const Engine = {

    // Get MatchUps on each metric.  noise = 0 for true baseline or 1 to allow for noise
    getMatchUpDelta: function(tA, tB, noise=0, team_label='') {
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
        const thirdDownAdv = (Utils.getZ(tA.off_3rd_down_pct, App.data.leagueMetrics.off3rdConversion) + (noise * Utils.boxMuller() * bm_f))
                            - (Utils.getZ(tB.def_3rd_down_allowed_pct, App.data.leagueMetrics.def3rdConversion, true) + (noise * Utils.boxMuller() * bm_f));

        const fourthDownAdv = (Utils.getZ(tA.off_4th_down_pct, App.data.leagueMetrics.off4thConversion) + (noise * Utils.boxMuller() * bm_f))
                            - (Utils.getZ(tB.def_4th_down_allowed_pct, App.data.leagueMetrics.def4thConversion, true) + (noise * Utils.boxMuller() * bm_f));
        
        //Turnovers (Offense wants low, Defense wants High)
        const turnoverAdv = (Utils.getZ(tA.off_turnovers_per_game, App.data.leagueMetrics.offTurnOver, true) + (noise * Utils.boxMuller() * bm_f))
                        - (Utils.getZ(tB.def_turnovers_forced_per_game, App.data.leagueMetrics.defTurnOverForced) + (noise * Utils.boxMuller() * bm_f));

        //Yards per penalty (Offense wants low, Defense wants High)
        const yardsPerPenaltyAdv = (Utils.getZ(tA.off_penalty_yards_per_penalty, App.data.leagueMetrics.offPen, true) + (noise * Utils.boxMuller() * bm_f))
                            - (Utils.getZ(tB.def_penalty_yards_per_penalty, App.data.leagueMetrics.defPen) + (noise * Utils.boxMuller() * bm_f));

        
        //Red Zone & Explosive Plays
        const redZoneAdv = (Utils.getZ(tA.off_rz_efficiency_pct, App.data.leagueMetrics.offRZ) + (noise * Utils.boxMuller() * bm_f))
                        - (Utils.getZ(tB.def_rz_efficiency_allowed_pct, App.data.leagueMetrics.defRZ, true) + (noise * Utils.boxMuller() * bm_f));
        
        const explosivePlayAdv = (Utils.getZ(tA.off_explosive_play_rate_pct, App.data.leagueMetrics.offExplosivePlay) + (noise * Utils.boxMuller() * bm_f))
                            - (Utils.getZ(tB.def_explosive_play_rate_allowed_pct, App.data.leagueMetrics.defExplosivePlay, true) + (noise * Utils.boxMuller() * bm_f));

        
        //Special Teams
        const fieldPositionAdv = (Utils.getZ(tA.off_avg_starting_field_pos, App.data.leagueMetrics.offStartingFieldPos) + (noise * Utils.boxMuller() * bm_f))
                            - (Utils.getZ(tB.def_avg_starting_field_pos_allowed, App.data.leagueMetrics.defStartingFieldPos, true) + (noise * Utils.boxMuller() * bm_f));

        
        

        //Push to team specific matchUp Object
        if (team_label !== '') {
            App.simulation.keyMatchup.push({
                team_label: team_label
                , passAdv: (passAdv * SIM_CONFIG.weights.passVolume)
                , qbAdv: (qbAdv * SIM_CONFIG.weights.qb)
                , teAdv: (teAdv * SIM_CONFIG.weights.te)
                , wrAdv: (wrAdv * SIM_CONFIG.weights.wr)
                , rushAdv: (rushAdv * SIM_CONFIG.weights.rush) 
                , pressureAdv: (pressureAdv * SIM_CONFIG.weights.pressure)
                , thirdDownAdv: (thirdDownAdv * SIM_CONFIG.weights.thirdDown)
                , fourthDownAdv: (fourthDownAdv * SIM_CONFIG.weights.fourthDown)
                , turnoverAdv: (turnoverAdv * SIM_CONFIG.weights.turnover)
                , yardsPerPenaltyAdv: (yardsPerPenaltyAdv * SIM_CONFIG.weights.penalty)
                , redZoneAdv: (redZoneAdv * SIM_CONFIG.weights.redZone) 
                , explosivePlayAdv: (explosivePlayAdv * SIM_CONFIG.weights.explosive)
                , fieldPositionAdv: (fieldPositionAdv * SIM_CONFIG.weights.fieldPosition)                
                
            });
        };

        //Calculate rawDelta
        const rawDelta = (passAdv * SIM_CONFIG.weights.passVolume)
            + (qbAdv * SIM_CONFIG.weights.qb)
            + (teAdv * SIM_CONFIG.weights.te)
            + (wrAdv * SIM_CONFIG.weights.wr)
            + (rushAdv * SIM_CONFIG.weights.rush) 
            + (pressureAdv * SIM_CONFIG.weights.pressure)
            + (thirdDownAdv * SIM_CONFIG.weights.thirdDown)
            + (fourthDownAdv * SIM_CONFIG.weights.fourthDown)
            + (turnoverAdv * SIM_CONFIG.weights.turnover)
            + (yardsPerPenaltyAdv * SIM_CONFIG.weights.penalty)
            + (redZoneAdv * SIM_CONFIG.weights.redZone) 
            + (explosivePlayAdv * SIM_CONFIG.weights.explosive)
            + (fieldPositionAdv * SIM_CONFIG.weights.fieldPosition)
            
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

    storeRun: function (order, lbl, teamStrengthA, teamStrengthB, factors = 0, compressor=1) {        
        let delta = 0.00;
        delta += (teamStrengthA - teamStrengthB) + factors; 
        delta *= compressor;
        
        const probA = Utils.sigmoid(delta, SIM_CONFIG.k);
        const probB = 1-probA;

            
        App.simulation.runs.push({
            labelOrder: order,
            runLabel: lbl,
            teamStrength_A: teamStrengthA,
            teamStrength_B: teamStrengthB,
            delta: delta,
            winProb_A: probA,
            winProb_B: probB,
            adjustmentFactors: factors,
            compressionValue: compressor
            
        });
        
    },


    getWeatherAdjustedStats: function (teamStats) {
        //capture context in easier variable
        const ctx = App.inputs.factors.context;
        //make a copy
        let adjusted = {...teamStats};
        
        //create an object for multipliers --- Inputs from ctx (pulled from App.inputs.factors.context) will adjust multiplier value.
        let multipliers = {
            passVol: 1.0
            , rushVol: 1.0
            , redZone: 1.0
            , explosive: 1.0
            , pressureAllowed: 1.0
            , turnovers: 1.0            
            , pressureGenerated: 1.0
            , rushDef: 1.0
            , passDef: 1.0
            , explosiveDef: 1.0
            , fieldGoals: 1.0
        };
        //Apply Wind  
        if (ctx.windLevel === 1) { //Medium Wind
            multipliers.passVol *= .95;
            multipliers.explosive *= .90;
            multipliers.fieldGoals *= .90;
        } else if (ctx.windLevel === 2) { //High Wind
            multipliers.passVol *= .85;
            multipliers.explosive *= .80;
            multipliers.turnovers *= 1.05;
            multipliers.fieldGoals *= .80;
        }

        //Apply Rain and Snow  
        if (ctx.rainLevel === 1) { //Rain
            multipliers.passVol *= .95;
            multipliers.explosive *= .95;
            multipliers.turnovers *= 1.25;
            multipliers.fieldGoals *= .98;
        } else if (ctx.rainLevel === 2) { //Snow
            multipliers.passVol *= .92;
            multipliers.explosive *= .82;
            multipliers.turnovers *= 1.35;
            multipliers.fieldGoals *= .90;
        }
    
        //Resistance Mode: Apply multipliers to stats.
        adjusted.off_pass_yards_per_game *= multipliers.passVol;
        adjusted.off_rush_yards_per_game *= multipliers.rushVol;
        adjusted.off_rz_efficiency_pct *= multipliers.redZone;
        adjusted.off_explosive_play_rate_pct *= multipliers.explosive;
        adjusted.off_pressure_allowed_pct *= multipliers.pressureAllowed;
        adjusted.off_turnovers_per_game *= multipliers.turnovers;
        adjusted.off_fg_accuracy_pct *= multipliers.fieldGoals;
    

        return adjusted;
    },


    //Run various scenarios & store results of each
    run: function(teamA, teamB, factors) {                
        
        // Reset Results
        App.simulation.results = [];
        App.simulation.runs = [];     
        App.simulation.keyMatchup = [];
        
        
        //capture base results with no noise or adjustments or injuries
        const baseA = this.getMatchUpDelta(teamA, teamB, 0);
        const baseB = this.getMatchUpDelta(teamB, teamA, 0);
        //const baseDelta = (baseA - baseB);  
        
        //Scenario #1: Just head to head stats
        this.storeRun(1, 'Head to Head with just Stats', baseA, baseB);


        //Scenario #2: Head to Head with Monte Carlo Simulation
        for (let i = 0; i < SIM_CONFIG.iterations; i++) {
            //get team strength with slight 'noise' applied to each team stat metric
            //3rd variable is noise.  value = 1 allows boxMuller variance to be adjusted
            const tsA_1 = this.getMatchUpDelta(teamA, teamB, 1);  
            const tsB_1 = this.getMatchUpDelta(teamB, teamA, 1);  
            this.storeRun(2, 'Head to Head (w Monte Carlo Simulation)', tsA_1, tsB_1);
            
        }


        //Scenario #3: H2H + Stadium: Venue & Weather with Monte Carlo Simulation
        const contextHFA = this.getHomeFieldAdvantage();
        
        const weatherAdjTeamA = this.getWeatherAdjustedStats(teamA);
        const weatherAdjTeamB = this.getWeatherAdjustedStats(teamB);
        
        for (let i = 0; i < SIM_CONFIG.iterations; i++) {
            //get team strength with slight 'noise' applied to each team stat metric
            //3rd variable is noise.  value = 1 allows boxMuller variance to be adjusted
            const tsA_2 = this.getMatchUpDelta(weatherAdjTeamA, weatherAdjTeamB, 1, 'teamA');  //add teamA label to push matchups to App.simulation.keyMatchup object
            const tsB_2 = this.getMatchUpDelta(weatherAdjTeamB, weatherAdjTeamA, 1, 'teamB');  //add teamB label to push matchups to App.simulation.keyMatchup object 
            this.storeRun(3, 'H2H + Stadium (w Monte Carlo Simulation)', tsA_2, tsB_2, contextHFA);
            
        }


        //Scenario #4: H2H + Stadium + Fatigue with Monte Carlo Simulation
        const contextTravel = this.getTravelPenalty();
        const contextRest = this.getTotalRestDelta();
                
        for (let i = 0; i < SIM_CONFIG.iterations; i++) {
            //get team strength with slight 'noise' applied to each team stat metric
            //3rd variable is noise.  value = 1 allows boxMuller variance to be adjusted
            const tsA_3 = this.getMatchUpDelta(weatherAdjTeamA, weatherAdjTeamB, 1, 'teamA');  //add teamA label to push matchups to App.simulation.keyMatchup object
            const tsB_3 = this.getMatchUpDelta(weatherAdjTeamB, weatherAdjTeamA, 1, 'teamB');  //add teamB label to push matchups to App.simulation.keyMatchup object 
            this.storeRun(4, 'H2H + Stadium + Fatigue (w MCS)', tsA_3, tsB_3, (contextHFA + contextTravel + contextRest));
            
        }


        //Scenario #5: H2H + Stadium + Fatigue + Competitive with Monte Carlo Simulation
        const contextMomentum = this.getMomentumAdvantage();  
        const contextCompressor = this.getDivisionCompressor() * this.getMatchUpCompressor();
                
        for (let i = 0; i < SIM_CONFIG.iterations; i++) {
            //get team strength with slight 'noise' applied to each team stat metric
            //3rd variable is noise.  value = 1 allows boxMuller variance to be adjusted
            const tsA_3 = this.getMatchUpDelta(weatherAdjTeamA, weatherAdjTeamB, 1, 'teamA');  //add teamA label to push matchups to App.simulation.keyMatchup object
            const tsB_3 = this.getMatchUpDelta(weatherAdjTeamB, weatherAdjTeamA, 1, 'teamB');  //add teamB label to push matchups to App.simulation.keyMatchup object 
            this.storeRun(5, 'H2H + Stadium + Fatigue + Competitive Factors (w MCS)', tsA_3, tsB_3, (contextHFA + contextTravel + contextRest + contextMomentum), contextCompressor);
            
        }

        //Calculate Summary Stats by Label
        const runSummary = this.calculateSummary(App.simulation.runs);
        //Store results in App
        App.simulation.summary = runSummary;


        //Calculate keyMatchUp summary stats by label
        const matchUpSummary = this.summarizeMatchUps(App.simulation.keyMatchup);
        //remove placeholder data from keyMatchup
        App.simulation.keyMatchup = [];
        //Store results in App
        App.simulation.keyMatchup = matchUpSummary;
    },

    
    calculateSummary: function(data) {
        // 1. Group values into arrays by runLabel
        const groups = data.reduce((acc, { runLabel, winProb_A }) => {
          acc[runLabel] = acc[runLabel] || [];
          acc[runLabel].push(winProb_A);
          return acc;
        }, {});
        
        // Helper to calculate percentile from a sorted array
        const getPercentile = (arr, p) => {
          const idx = (arr.length - 1) * p;
          const lower = Math.floor(idx);
          const upper = Math.ceil(idx);
          const weight = idx - lower;
          return arr[lower] * (1 - weight) + arr[upper] * weight;
        };
        
        // 2. Map groups to final statistics
        const stats = Object.entries(groups).map(([label, values]) => {
          values.sort((a, b) => a - b); // Percentiles require sorted data
          return {
            runLabel: label,
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            p5: getPercentile(values, 0.05),
            p50: getPercentile(values, 0.50), // Median
            p95: getPercentile(values, 0.95)
          };
        });
        
        return stats;
    },


    summarizeMatchUps: function(data) {
        const averages = App.simulation.keyMatchup.reduce((acc, entry) => {
            const team = entry.team_label;
    
            // Initialize team object if it doesn't exist
            if (!acc[team]) {
                acc[team] = { count: 0, sums: {} };
            }
    
            acc[team].count++;
    
            // Sum up all numeric metrics
            for (const [key, value] of Object.entries(entry)) {
                if (typeof value === 'number') {
                    acc[team].sums[key] = (acc[team].sums[key] || 0) + value;
                }
            }
    
            return acc;
        }, {});

        // Final step: Divide sums by count to get the average
        const result = Object.keys(averages).map(team => ({
            team_label: team,
            averages: Object.fromEntries(
                Object.entries(averages[team].sums).map(([key, sum]) => [
                    key, sum / averages[team].count
                ])
            )
        }));

        return result;
    },


    sortMatchUps: function (lbl) {
        //Get team specific averages
        const teamData = App.simulation.keyMatchup.find(r=>r.team_label === lbl).averages;
        
        //Sort based on values High -> Low
        const sortedTeamA = Object.keys(teamData)
            .sort((a, b) => teamData[b] - teamData[a]) // Compare values
            .reduce((acc, key) => {
                acc[key] = teamData[key];
                return acc;
            }, {});
        
        return teamData;
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

    
      
};
