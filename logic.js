/* logic.js */

// --- 1. Global State & Constants ---
let globalData = null;
let currentSeasonData = null;
let teamA = null;
let teamB = null;
let results = [];
let simulationRuns = [];
let factors = [];

const SIM_CONFIG = {
    iterations: 10000,
    hfa: 0.04,                    //z score based on 2 Pts of historical HFA; historical Mean Spread of 2.5 pts; historical StdDev of 13.2 points.  Historical is Post 1990
    travel_penalty_val: 0.03,      //z score slighly less than HFA
    momentumValue_val: 0.03,       //z score slighly less than HFA
    k: 0.65,
    weights: {
            passVolume: 0.30,   // Reduced from 1.0 because we added WR/TE/QB
            rush: 0.85,         // Stays the primary rushing metric
            qb: 0.55,           // 
            wr: 0.20,           // 
            te: 0.20,           // 
            turnover: 1.50,     // HUGE. Turnovers kill drives and lose games.
            redZone: 0.70,      // Yards don't matter if you can't finish.
            explosive: 0.40,    // Measures "Quick Strike" ability
            pressure: 0.50      // Measures "Disruption" (Sacks/Hurries)
            },
    noiseThreshold: 0.65 // Baseline "Stable"    
};
    


// --- 2. Core Math Utilities ---
const mathUtils = {
    getStats: (values) => {
        const n = values.length;
        const avg = values.reduce((a, b) => a + b, 0) / n;
        const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / n);
        return { avg, stdDev };
    },
    getZ: (val, stats, invert = false) => {
        const z = (val - stats.avg) / stats.stdDev;
        return invert ? -z : z;
    },
    sigmoid: (z) => 1 / (1 + Math.exp(-(SIM_CONFIG.k * z))),
    generateNoise: (lvl) => (Math.random() * 2 - 1) * lvl,
    getPercentile: (arr, p) => {
        const idx = (p / 100) * (arr.length - 1);
        const low = Math.floor(idx), high = Math.ceil(idx), w = idx - low;
        return arr[low] + w * (arr[high] - arr[low]);
    },
    toOrdinal: (n) => {
        const s = ["th", "st", "nd", "rd"], v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
};

// --- 2.1 Core Math Utilities ---
const analysisUtils = {
    interpretMedianDelta: (delta, teamA, teamB) => {
        const absDelta = Math.abs(delta);
        const favored = delta > 0 ? teamA : teamB;
        if (absDelta < 0.15) return `This matchup is effectively even.`;
        if (absDelta < 0.50) return `${favored} holds a slight overall advantage.`;
        if (absDelta < 1.00) return `${favored} has a clear but not dominant advantage.`;
        if (absDelta < 2.00) return `${favored} is meaningfully stronger and should control the game.`;
        return `${favored} has a decisive advantage.`;
    },

    interpretStability: (p25, p75, p10, p90) => {
        const iqr = p75 - p25;
        const crossesZero = p10 < 0 && p90 > 0;
        if (iqr < 0.5 && !crossesZero) return "Highly stable; outcomes cluster tightly.";
        if (iqr < 1.0 && !crossesZero) return "Reliable range; outcomes are fairly predictable.";
        if (iqr < 1.5) return "Moderate volatility; paths exist for both teams.";
        return "Highly volatile; strong upset potential.";
    },

    interpretUpset: (rate) => {
        if (rate < 0.15) return "Upsets are rare.";
        if (rate < 0.30) return "Possible but unlikely.";
        if (rate < 0.45) return "Meaningful upset potential.";
        return "Highly unpredictable; a true toss-up.";
    }
};

// --- 2.2 Normalize total score to keep std ~ 1 ---
const calculateNormalizationFactor = (weights) => {
    let sumOfSquares = 0;
    for (let key in weights) {
        sumOfSquares += (weights[key] * weights[key]);
    }
    // Multiply by sqrt(2) because we are comparing two independent variables (Team A vs Team B)
    return Math.sqrt(sumOfSquares) * 1.414;
};
SIM_CONFIG.normalizationFactor = calculateNormalizationFactor(SIM_CONFIG.weights);

/* --- 2.3 Adjusts raw stats based on Strength of Schedule (SoS)
    * Adjusts raw stats based on Strength of Schedule (SoS)
    * Assumes 'sos_rating' is a Z-Score or similar relative rating (e.g. +5.0 is hard, -5.0 is easy)
    * If you don't have SoS data yet, this safely returns the original stats.*/

const applySoSAdjustment = (teamStats, sosRating = 0) => {
    let adjusted = { ...teamStats };
    
    // SoS Factor: 1.0 is neutral. 
    // A hard schedule (+5.0) might boost offensive stats by 5% (1.05) because they earned them harder.
    // A soft schedule (-5.0) might lower them by 5% (0.95).
    const sosFactor = 1 + (sosRating * 0.01); 

    // We apply this to Volume stats, but not necessarily Efficiency stats (like percentages)
    // as Efficiency is more "sticky" regardless of opponent.
    if (adjusted.off_pass_yards_per_game) adjusted.off_pass_yards_per_game *= sosFactor;
    if (adjusted.off_rush_yards_per_game) adjusted.off_rush_yards_per_game *= sosFactor;
    
    // For Defense, it's inverse. If you faced a hard schedule (good offenses),
    // allowing yards is "forgivable", so we lower your allowed stats (improvement).
    const defSosFactor = 1 - (sosRating * 0.01);
    if (adjusted.def_pass_yards_allowed_per_game) adjusted.def_pass_yards_allowed_per_game *= defSosFactor;
    if (adjusted.def_rush_yards_allowed_per_game) adjusted.def_rush_yards_allowed_per_game *= defSosFactor;

    return adjusted;
};



// --- 3. Initialization & Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('teams.json');
        globalData = await res.json();
        initDropdowns();
        setupEventListeners();
    } catch (err) { console.error("Load Error:", err); }
});

function setupEventListeners() {
    document.getElementById('season-select').addEventListener('change', updateMatchupTable);
    document.getElementById('team-a-select').addEventListener('change', updateMatchupTable);
    document.getElementById('team-b-select').addEventListener('change', updateMatchupTable);

    document.getElementById('team-a-select').addEventListener('change', handleTeamChange);
    document.getElementById('team-b-select').addEventListener('change', handleTeamChange);
    
    document.getElementById('run-sim-btn').addEventListener('click', runSimulationController);
    document.getElementById('reset-btn').addEventListener('click', () => location.reload());
}

function initDropdowns() {
    const sSel = document.getElementById('season-select');
    const aSel = document.getElementById('team-a-select');
    const bSel = document.getElementById('team-b-select');

    // Populate Seasons
    globalData.seasons.sort((a, b) => b.season - a.season).forEach(s => {
        sSel.add(new Option(`${s.season} Season`, s.season));
    });

    // Populate Teams (Alphabetical)
    const teams = [...globalData.seasons[0].teams].sort((a, b) => a.teamName.localeCompare(b.teamName));
    teams.forEach(t => {
        aSel.add(new Option(t.teamName, t.teamId));
        bSel.add(new Option(t.teamName, t.teamId));
    });
}


// --- 4.0 UI: Update Team Selection Options ---
    const handleTeamChange = (event) => {
        const selectedText = event.target.options[event.target.selectedIndex].text;
        // Determine if it's 'teamA' or 'teamB' based on the ID
        const teamKey = event.target.id.includes('-a-') ? 'teamA' : 'teamB';
        
        populateSituationalInputs(teamKey, selectedText);
    };
    
    function populateSituationalInputs(key, teamName) {
        // Standardize IDs so they only differ by the suffix (teamA vs teamB)
        const suffix = key; 
    
        const updates = [
            { id: `hfa-${suffix}`, text: teamName },
            { id: `rest-gap-${suffix}`, text: `Rest Gap for ${teamName}` },
            { id: `momentum-${suffix}`, text: teamName },
            { id: `travel-${suffix}`, text: `${teamName} Traveled` },
            { id: `accordion-header-${key === 'teamA' ? 'team-a' : 'team-b'}`, text: `3. Injury Report: ${teamName}` }
        ];
    
        updates.forEach(item => updateElementText(item.id, item.text));
    }
    
    function updateElementText(elId, content) {
        const el = document.getElementById(elId);
        if (el) {
            // Use textContent instead of innerHTML for better performance and security
            el.textContent = content;
        }
    }



// --- 4.1 UI: Update Comparison Table ---
function updateMatchupTable() {
    const yr = document.getElementById('season-select').value;
    const idA = document.getElementById('team-a-select').value;
    const idB = document.getElementById('team-b-select').value;
    if (!yr || !idA || !idB) return;

    currentSeasonData = globalData.seasons.find(s => s.season == yr);
    teamA = currentSeasonData.teams.find(t => t.teamId === idA);
    teamB = currentSeasonData.teams.find(t => t.teamId === idB);

    document.getElementById('table-header-metrics').textContent = `${yr} Metrics`;
    document.getElementById('table-header-a').textContent = teamA.teamId;
    document.getElementById('table-header-a').style.borderBottom = `4px solid ${teamA.primaryColor}`;
    document.getElementById('table-header-b').textContent = teamB.teamId;
    document.getElementById('table-header-b').style.borderBottom = `4px solid ${teamB.primaryColor}`;

    const metrics = [
        { label: "Points Scored / gm", key: "off_points_scored_per_game", r: "off_points_scored_per_game_rank" },
        { label: "Pass Yds / gm", key: "off_pass_yards_per_game", r: "off_pass_yards_per_game_rank" },
        { label: "Rush Yds / gm", key: "off_rush_yards_per_game", r: "off_rush_yards_per_game_rank" },
        { label: "QB Rating", key: "off_passer_rating", r: "off_passer_rating_rank" },
        { label: "TE Yds / gm", key: "off_te_yards_per_game", r: "off_te_performance_rank" },
        { label: "WR Yds / gm", key: "off_wr_yards_per_game", r: "off_wr_performance_rank" },
        { label: "Turnovers / gm", key: "off_turnovers_per_game", r: "off_turnovers_rank" },
        { label: "Red Zone Efficiency %", key: "off_rz_efficiency_pct", r: "off_rz_efficiency_rank" },
        { label: "Explosive Plays %", key: "off_explosive_play_rate_pct", r: "off_explosive_play_rate_rank" },
        { label: "Offensive Pressure Allowed %", key: "off_pressure_allowed_pct", r: "off_pressure_allowed_rank" },
        
        { label: "Points Allowed", key: "def_points_allowed_per_game", r: "def_points_rank" },
        { label: "Def Pass Yds Allowed", key: "def_pass_yards_allowed_per_game", r: "def_pass_yards_allowed_per_game_rank" },
        { label: "Def Rush Yds Allowed", key: "def_rush_yards_allowed_per_game", r: "def_rush_yards_allowed_per_game_rank" },
        { label: "QB Rating Allowed", key: "def_passer_rating_allowed", r: "def_passer_rating_rank" },
        { label: "TE Yds Allowed / gm", key: "def_te_yards_allowed_per_game", r: "def_te_performance_rank" },
        { label: "WR Yds Allowed / gm", key: "def_wr_yards_allowed_per_game", r: "def_wr_performance_rank" },
        { label: "Turnovers Forced / gm", key: "def_turnovers_forced_per_game", r: "def_turnovers_rank" },
        { label: "Red Zone Efficiency Allowed %", key: "def_rz_efficiency_allowed_pct", r: "def_rz_efficiency_rank" },
        { label: "Explosive Plays Allowed %", key: "def_explosive_play_rate_allowed_pct", r: "def_explosive_play_rate_rank" },
        { label: "Defensive Pressure Generated %", key: "def_pressure_generated_pct", r: "def_pressure_generated_rank" }
    ];

    const tbody = document.getElementById('stats-table-body');
    tbody.innerHTML = `<tr><td>Record</td><td>${teamA.wins}-${teamA.losses}</td><td>${teamB.wins}-${teamB.losses}</td></tr>`;
    
    metrics.forEach((m, i) => {
        if (i === 0) {
            tbody.innerHTML +=`<tr><td style="padding-left:20px">Offense</td><td></td><td></td></tr>`;
        } else if (i === 10) {
            tbody.innerHTML +=`<tr><td style="padding-left:20px">Defense</td><td></td><td></td></tr>`;
        } 
        tbody.innerHTML += `<tr>
            <td style="padding-left:45px">${m.label}</td>
            <td>${teamA[m.key]} <small>(${mathUtils.toOrdinal(teamA[m.r])})</small></td>
            <td>${teamB[m.key]} <small>(${mathUtils.toOrdinal(teamB[m.r])})</small></td>
        </tr>`;
        
    });

}

// --- 5. The Engine: Monte Carlo Controller ---
function runSimulationController() {
    if (!teamA || !teamB) return;

    results =[];
    simulationRuns =[];
    factors =[];
    

    // A. Get Factors from UI
    factors = getSituationalFactors();
    const { context, rest } = factors;

    // SoS Adjustment (Before Injuries) ---
    // We try to access 'sos_rating' from your team object. 
    // If your JSON doesn't have it, it defaults to 0 (no effect).
    let sosAdjustedA = applySoSAdjustment(teamA, teamA.sos_rating || 0);
    let sosAdjustedB = applySoSAdjustment(teamB, teamB.sos_rating || 0);
    
    // B. NEW: The Bridge - Convert Slider Objects to Detailed Injury Arrays
    const createInjuryArray = (injObj) => {
        let arr = [];
        // Simple Mappings
        if (injObj.qb > 0) arr.push({ pos: 'qb', level: injObj.qb, role: 'QB1' });
        if (injObj.rb > 0) arr.push({ pos: 'rb', level: injObj.rb, role: 'RB1' });
        if (injObj.wr > 0) arr.push({ pos: 'wr', level: injObj.wr, role: 'WR1' });
        if (injObj.te > 0) arr.push({ pos: 'te', level: injObj.te, role: 'TE1' });
        if (injObj.dLine > 0) arr.push({ pos: 'dLine', level: injObj.dLine, role: 'Edge1' });

        // CLIFF MAPPINGS (Logic to trigger system failure based on slider severity)
        
        // If OL Slider is 2 (Out), we assume catastrophic injury (3+ starters) to trigger the Cliff
        // If OL Slider is 1 (Questionable), we assume mild injury (1 starter)
        if (injObj.olLine === 2) {
             // Push 3 entries to trigger count >= 3 in processor
             arr.push({ pos: 'olLine', level: 2, role: 'LT' });
             arr.push({ pos: 'olLine', level: 2, role: 'LG' });
             arr.push({ pos: 'olLine', level: 2, role: 'C' });
        } else if (injObj.olLine === 1) {
             arr.push({ pos: 'olLine', level: 1, role: 'LT' });
        }

        // If Secondary Slider is 2 (Out), we assume CB1 + CB2 Out to trigger Cliff
        if (injObj.dSecondary === 2) {
            arr.push({ pos: 'secondary', level: 2, role: 'CB1' });
            arr.push({ pos: 'secondary', level: 2, role: 'CB2' });
        } else if (injObj.dSecondary === 1) {
            arr.push({ pos: 'secondary', level: 1, role: 'CB1' });
        }

        return arr;
    };

    const injuriesListA = createInjuryArray(factors.injuriesA);
    const injuriesListB = createInjuryArray(factors.injuriesB);        
    
    // C. Adjusted Stats (Injuries + Wind)
    const adjustedTeamA = getAdjustedTeamStats(sosAdjustedA, injuriesListA, context);
    const adjustedTeamB = getAdjustedTeamStats(sosAdjustedB, injuriesListB, context);
    
    // D. Pre-calculate League Stats (Context)
    const league = {
        offPass: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_pass_yards_per_game)),
        defPass: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_pass_yards_allowed_per_game)),
        
        offRush: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_rush_yards_per_game)),
        defRush: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_rush_yards_allowed_per_game)),        
        
        offPts: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_points_scored_per_game)),
        defPts: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_points_allowed_per_game)),

        offQB: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_passer_rating)),
        defQB: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_passer_rating_allowed)),
        
        offTE: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_te_yards_per_game)),
        defTE: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_te_yards_allowed_per_game)),
        
        offWR: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_wr_yards_per_game)),
        defWR: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_wr_yards_allowed_per_game)),
        
        offTurnOver: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_turnovers_per_game)),
        defTurnOver: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_turnovers_forced_per_game)),
        
        offRZ: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_rz_efficiency_pct)),
        defRZ: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_rz_efficiency_allowed_pct)),
        
        offExplosivePlay: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_explosive_play_rate_pct)),
        defExplosivePlay: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_explosive_play_rate_allowed_pct)),
        
        offPressure: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_pressure_allowed_pct)),
        defPressure: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_pressure_generated_pct))
    };

    // E. Calculate Matchup Z-Scores
    const getMatchupDelta = (tA, tB, noise) => {
        // --- PASSING GAME (Distributed Weights) ---
        // Split the "Passing Weight" across Volume, QB Skill, and Weapons
        
        // Volume: Yards vs Yards Allowed                
        const passAdv = (mathUtils.getZ(tA.off_pass_yards_per_game, league.offPass) + mathUtils.generateNoise(noise)) 
                   - (mathUtils.getZ(tB.def_pass_yards_allowed_per_game, league.defPass, true) + mathUtils.generateNoise(noise));
        
        // Efficiency: QB Rating vs QB Rating Allowed
        const qbAdv = (mathUtils.getZ(tA.off_passer_rating, league.offQB) + mathUtils.generateNoise(noise)) 
                   - (mathUtils.getZ(tB.def_passer_rating_allowed, league.defQB, true) + mathUtils.generateNoise(noise));
        
        // Weapons: Specific position groups
        const teAdv = (mathUtils.getZ(tA.off_te_yards_per_game, league.offTE) + mathUtils.generateNoise(noise)) 
                   - (mathUtils.getZ(tB.def_te_yards_allowed_per_game, league.defTE, true) + mathUtils.generateNoise(noise));
        
        const wrAdv = (mathUtils.getZ(tA.off_wr_yards_per_game, league.offWR) + mathUtils.generateNoise(noise)) 
                   - (mathUtils.getZ(tB.def_wr_yards_allowed_per_game, league.defWR, true) + mathUtils.generateNoise(noise));
        
        // --- RUSHING GAME ---
        const rushAdv = (mathUtils.getZ(tA.off_rush_yards_per_game, league.offRush) + mathUtils.generateNoise(noise)) 
                   - (mathUtils.getZ(tB.def_rush_yards_allowed_per_game, league.defRush, true) + mathUtils.generateNoise(noise));
        

        // --- GAME WRECKERS (The "Hidden" Yards) ---

        // Turnovers: CRITICAL. For Offense, LOWER Turnovers is better.         
        const turnoverAdv = (mathUtils.getZ(tA.off_turnovers_per_game, league.offTurnOver, true) + mathUtils.generateNoise(noise)) 
                   - (mathUtils.getZ(tB.def_turnovers_forced_per_game, league.defTurnOver) + mathUtils.generateNoise(noise));

        // Pressure: Offense wants LOW pressure allowed (Inverted), Defense wants HIGH generated.
        const pressureAdv = (mathUtils.getZ(tA.off_pressure_allowed_pct, league.offPressure, true) + mathUtils.generateNoise(noise)) 
                          - (mathUtils.getZ(tB.def_pressure_generated_pct, league.defPressure) + mathUtils.generateNoise(noise));
    
        // Red Zone & Explosiveness (Standard: Higher is Better)
        const redZoneAdv = (mathUtils.getZ(tA.off_rz_efficiency_pct, league.offRZ) + mathUtils.generateNoise(noise)) 
                         - (mathUtils.getZ(tB.def_rz_efficiency_allowed_pct, league.defRZ, true) + mathUtils.generateNoise(noise));        
    
        const explosivePlayAdv = (mathUtils.getZ(tA.off_explosive_play_rate_pct, league.offExplosivePlay) + mathUtils.generateNoise(noise)) 
                               - (mathUtils.getZ(tB.def_explosive_play_rate_allowed_pct, league.defExplosivePlay, true) + mathUtils.generateNoise(noise));
        
        
        const rawDelta =  (passAdv * SIM_CONFIG.weights.passVolume) 
             + (qbAdv * SIM_CONFIG.weights.qb) 
             + (wrAdv * SIM_CONFIG.weights.wr) 
             + (teAdv * SIM_CONFIG.weights.te)
             + (rushAdv * SIM_CONFIG.weights.rush) 
             + (turnoverAdv * SIM_CONFIG.weights.turnover) 
             + (redZoneAdv * SIM_CONFIG.weights.redZone) 
             + (explosivePlayAdv * SIM_CONFIG.weights.explosive) 
             + (pressureAdv * SIM_CONFIG.weights.pressure);

        // NEW: Normalize the result so we don't break the Sigmoid        
        let finalDelta = rawDelta / SIM_CONFIG.normalizationFactor;

        // --- NEW: RED ZONE LEVERAGE MULTIPLIER ---
        // If one team has a massive RZ advantage (> 1.0 Z-Score), we magnify their "Win" logic.
        // This simulates "Finishing Drives" vs "Settling for FGs".
        if (Math.abs(redZoneAdv) > 1.0) {
            // If the team with the RZ advantage is winning the delta, boost them further.
            // If they are losing the delta, they might "stick around" longer (catch-up logic), 
            // but usually RZ advantage magnifies the lead.
            if ((redZoneAdv > 0 && finalDelta > 0) || (redZoneAdv < 0 && finalDelta < 0)) {
                 finalDelta *= 1.10; // 10% Boost to the overall strength for being a "Finisher"
            }
        }

        return finalDelta;
    };

    // C. Contextual Situational ZScore Adjustments
        // 1. Home Field Advantage
            let hfaValue = 0;
            if (contextSettings.hfa === 1) hfaValue = SIM_CONFIG.hfa;       // Team A Home
            else if (contextSettings.hfa === 3) hfaValue = -SIM_CONFIG.hfa; // Team B Home (Negative for A)
            // contextSettings.hfa === 2 is Neutral (0)
        
        // 2. Travel Penalty (Who is tired?)            
            let travelPenalty = 0;             
            if (contextSettings.travel === 1) travelPenalty = -SIM_CONFIG.travel_penalty_val; // A is traveling (Penalty to A)
            else if (contextSettings.travel === 3) travelPenalty = SIM_CONFIG.travel_penalty_val; // B is traveling (Bonus to A)

        // 3. Momentum (Who has it?)
            let momentumValue = 0;             
            if (contextSettings.momentum === 1) momentumValue = SIM_CONFIG.momentumValue_val; // A has momentum (Bonus to A)
            else if (contextSettings.momentum === 3) momentumValue = -SIM_CONFIG.momentumValue_val; // B has momentum (Negative to A)
    
        // 3. Rest Gap (Who is tired?)            
            // 0 = Short (-0.05), 1 = Standard (0.0), 2 = Bye (+0.07)
            // We give a slightly larger bonus to Bye weeks for coaching prep.
            const getRestImpact = (val) => {
                if (val === 0) return -0.05; // Tired / No Prep
                if (val === 2) return 0.07;  // Rested / Scheme Install
                return 0.0;
            };
            
            const restImpactA = getRestImpact(rest.teamA);
            const restImpactB = getRestImpact(rest.teamB);
            const totalRestDelta = restImpactA - restImpactB; 
            // Example: A is Bye (0.07), B is Short (-0.05). Total = 0.12 (Significant advantage)
            
        // 4. Division Matchup
            // Division games are often tighter/grittier. We compress the final delta.
            const divisionCompressor = contextSettings.divisionMatchUp ? 0.90 : 1.0;

        // 5. Game Matchup Type (e.g. 0=Regular, 3 = Super Bowl
            // Play off games are often tighter/grittier with each round. We compress the final delta.
            const gmMatchUpValue = contextSettings.gameMatchUpType;
            const gmMatchUpCompressor = contextSettings.gameMatchUpMapping[gmMatchUpValue];

    
    // d. The Simulation Loop
    let totalProbA = 0;    
    for (let i = 0; i < SIM_CONFIG.iterations; i++) {
        //1. Calculat simulated results and delta for this 'any given sunday' simulated run.  Use adjustedTeamA and adjustedTeamB for injuries        
            const strA = getMatchupDelta(adjustedTeamA, adjustedTeamB, SIM_CONFIG.noiseThreshold);
            const strB = getMatchupDelta(adjustedTeamB, adjustedTeamA, SIM_CONFIG.noiseThreshold);

        //2. Apply Context (HFA + Travel)
        // Note: strA and strB are raw performance. We add context to the Delta.
            let delta = (strA - strB) + hfaValue + travelPenalty + totalRestDelta;

        //3. Apply Division Compression
            delta = delta * divisionCompressor * gmMatchUpCompressor;
                
        //4. Map this delta to a Probability using Sigmoid
            const probA = mathUtils.sigmoid(delta);
            const probB = 1 - probA; // Fixed missing variable
        
        //5. Accumulate and Store
            totalProbA += probA;
            results.push(delta);   
        
        //6. Store in Simulation for Visual.js
            simulationRuns.push({
                    simulatedRun: i+1,
                    teamA_Id: teamA.teamId,
                    teamA_Name: teamA.teamName,
                    teamA_Color: teamA.primaryColor,
                    teamB_Id: teamB.teamId,
                    teamB_Name: teamB.teamName,
                    teamB_Color: teamB.primaryColor,
                    teamA_Strength: strA,
                    teamB_Strength: strB,
                    delta,
                    teamA_Prob: probA,
                    teamB_Prob: probB
                    });
            }
        //Final Calculations
        const winProbA = totalProbA / SIM_CONFIG.iterations;    
        const winProbB = 1 - winProbA;
        results.sort((a, b) => a - b);
    
    // D. Process Results
    const summary = {        
        winProbA: winProbA,
        winProbB: winProbB,
        medianDelta: mathUtils.getPercentile(results, 50),
        p10: mathUtils.getPercentile(results, 10),
        p25: mathUtils.getPercentile(results, 25),
        p75: mathUtils.getPercentile(results, 75),
        p90: mathUtils.getPercentile(results, 90),
        p2_5: mathUtils.getPercentile(results, 2.5),
        p97_5: mathUtils.getPercentile(results, 97.5),
        iqr: mathUtils.getPercentile(results, 75) - mathUtils.getPercentile(results, 25)
    };

    renderAnalytics(summary, league);

}

// --- 6.0 Separate helpers for the Interpretations to keep things tidy --- 
function getFrangibility(winProbA, iqr) {
    const winMargin = Math.abs(winProbA - 0.5); // 0.00 = 50/50 split; 0.50 = 100% win

    // --- TIER 1: EXTREME VOLATILITY (The "Wildcard" Factor) ---
    // If the simulation variance is huge (>1.5), the "average" result means nothing.
    // This happens when high-offense teams play no defense (shootout potential).
    if (iqr > 1.5) {
        return { 
            label: "Chaotic", 
            color: "text-purple", // Use a distinct color for 'weird' games
            desc: "Extreme volatility detected. Expect a shootout or weird turnovers. Stats are less reliable here." 
        };
    }

    // --- TIER 2: THE LOCK (Dominant Advantage) ---
    // One team wins > 85% of the time (Margin > 0.35). 
    // Variance doesn't matter because the gap is too wide to bridge.
    if (winMargin > 0.35) {
        return { 
            label: "Very Stable (Lock)", 
            color: "text-success", 
            desc: "The talent gap is massive. An upset would be a statistical anomaly." 
        };
    }

    // --- TIER 3: THE "TRAP GAME" (Volatile Favorite) ---
    // The favorite wins ~65-80% (Margin > 0.15) BUT the variance is high (> 1.1).
    // This means the favorite is better, but inconsistent.
    if (winMargin > 0.15 && iqr > 1.1) {
        return { 
            label: "Moderate (Trap Game)", 
            color: "text-warning", 
            desc: "The favorite is clearly better but prone to variance. A sloppy game could open the door." 
        };
    }

    // --- TIER 4: THE PROFESSIONAL WIN (Stable Favorite) ---
    // The favorite wins ~60-80% AND variance is low (< 1.1).
    // They consistently beat this opponent.
    if (winMargin > 0.10 && iqr <= 1.1) {
        return { 
            label: "Stable", 
            color: "text-primary", 
            desc: "The favorite has a consistent advantage and rarely underperforms in this matchup." 
        };
    }

    // --- TIER 5: THE GRIND (Stable Close Game) ---
    // The game is close (Margin < 10%) BUT variance is low (< 0.85).
    // This isn't a random coin flip; it's two evenly matched teams playing tight.
    if (winMargin < 0.10 && iqr < 0.85) {
        return { 
            label: "High Tension (Grind)", 
            color: "text-info", 
            desc: "Evenly matched teams with low variance. Expect a close game decided by the final possession." 
        };
    }

    // --- TIER 6: THE COIN FLIP (Fragile) ---
    // The game is close (Margin < 10%) AND variance is normal/high.
    // This is "Any Given Sunday."
    if (winMargin < 0.10) {
        return { 
            label: "High (Fragile)", 
            color: "text-danger", 
            desc: "A true toss-up. The outcome likely hinges on a single big play or turnover." 
        };
    }

    // --- DEFAULT (The Catch-All) ---
    return { 
        label: "Moderate", 
        color: "text-secondary", 
        desc: "Standard NFL variance. A competitive game where the favorite has a slight edge." 
    };
}

function getConfidenceLabel(winProb, iqr, upsetRate) {
    const winMargin = Math.abs(winProb - 0.5);

    // Volatility Check: if the range is huge, it's always volatile
    if (iqr > 1.6) return "High Chaos";

    if (winProb > 0.65 || winProb < 0.35) {
        return (iqr < 0.9) ? "Strong Favorite" : "Moderate Favorite";
    }

    if (winProb > 0.55 || winProb < 0.45) {
        return "Slight Edge";
    }

    if (winMargin <= 0.05) {
        return "True Coin Flip";
    }

    return "Unclear Edge";
}

function getMatchupImpacts (tA, tB, league) {
    // Helper to calc weighted advantage
    // invert=true for stats where "Lower is Better" (Turnovers, Pressure Allowed)
    const getImpact = (offVal, offMean, defVal, defMean, weight, invert = false) => {
        let offZ = mathUtils.getZ(offVal, offMean);
        let defZ = mathUtils.getZ(defVal, defMean, true); // true = invert defense perspective
        
        if (invert) {
            offZ = offZ * -1; // Flip bad stats for offense
        }
        
        // The Gap * The Weight = The Real Impact
        return (offZ - defZ) * weight;
    };

    const impacts = [
        {
            id: 'pass', label: "Passing Volume",
            val: getImpact(tA.off_pass_yards_per_game, league.offPass, tB.def_pass_yards_allowed_per_game, league.defPass, SIM_CONFIG.weights.passVolume),
            narrative: "establish the aerial attack"
        },
        {
            id: 'rush', label: "Rushing Attack",
            val: getImpact(tA.off_rush_yards_per_game, league.offRush, tB.def_rush_yards_allowed_per_game, league.defRush, SIM_CONFIG.weights.rush),
            narrative: "control the clock on the ground"
        },
        {
            id: 'qb', label: "QB Play",
            val: getImpact(tA.off_passer_rating, league.offQB, tB.def_passer_rating_allowed, league.defQB, SIM_CONFIG.weights.qb),
            narrative: "rely on superior quarterback efficiency"
        },
        {
            id: 'wr', label: "WR Corps",
            val: getImpact(tA.off_wr_yards_per_game, league.offWR, tB.def_wr_yards_allowed_per_game, league.defWR, SIM_CONFIG.weights.wr),
            narrative: "exploit mismatches on the outside"
        },
        {
            id: 'te', label: "Tight Ends",
            val: getImpact(tA.off_te_yards_per_game, league.offTE, tB.def_te_yards_allowed_per_game, league.defTE, SIM_CONFIG.weights.te),
            narrative: "attack the middle of the field"
        },
        {
            id: 'turnover', label: "Ball Security",
            // Invert=true because LOW turnovers is good
            val: getImpact(tA.off_turnovers_per_game, league.offTurnOver, tB.def_turnovers_forced_per_game, league.defTurnOver, SIM_CONFIG.weights.turnover, true),
            narrative: "win the turnover battle"
        },
        {
            id: 'pressure', label: "Pass Protection",
            // Invert=true because LOW pressure allowed is good
            val: getImpact(tA.off_pressure_allowed_pct, league.offPressure, tB.def_pressure_generated_pct, league.defPressure, SIM_CONFIG.weights.pressure, true),
            narrative: "keep the pocket clean"
        },
        {
            id: 'redzone', label: "Red Zone",
            val: getImpact(tA.off_rz_efficiency_pct, league.offRZ, tB.def_rz_efficiency_allowed_pct, league.defRZ, SIM_CONFIG.weights.redZone),
            narrative: "finish drives with touchdowns"
        },
        {
            id: 'explosive', label: "Explosiveness",
            val: getImpact(tA.off_explosive_play_rate_pct, league.offExplosivePlay, tB.def_explosive_play_rate_allowed_pct, league.defExplosivePlay, SIM_CONFIG.weights.explosive),
            narrative: "generate big chunk plays"
        }
    ];

    // Sort by absolute impact (biggest movers first)
    return impacts.sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
};



function getKeysToSuccess(impacts, tA, tB) {
    // Find Team A's biggest strength (Max Positive)
    const bestForA = impacts.reduce((prev, current) => (prev.val > current.val) ? prev : current);
    
    // Find Team B's biggest strength (Max Negative / Lowest value)
    const bestForB = impacts.reduce((prev, current) => (prev.val < current.val) ? prev : current);

    // Dynamic Text Generation
    let textA = "";
    if (bestForA.val > 0) {
        textA = `${tA.teamName} must ${bestForA.narrative} (${bestForA.label}).`;
    } else {
        // If Team A has NO advantages (all values negative), pick the 'least bad' one
        textA = `${tA.teamName} faces an uphill battle but must try to ${bestForA.narrative}.`;
    }

    let textB = "";
    if (bestForB.val < 0) {
        textB = `${tB.teamName} must ${bestForB.narrative} (${bestForB.label}).`;
    } else {
        textB = `${tB.teamName} needs to ${bestForB.narrative} to hold their advantage.`;
    }

    return { teamA: textA, teamB: textB };
}


function renderTornadoChart(impacts, tA, tB) {
    let html = `<div style="font-size: 16px; margin-top: 10px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-weight:bold;">
            <span style="flex:1; text-align:right; padding-right:80px;">${tB.teamId} Advantage</span>
            <span style="flex:1; text-align:left; padding-left:80px;">${tA.teamId} Advantage</span>
        </div>`;

    // Take top 7 impacts only (to keep UI clean)
    //original: impacts.slice(0, 5).forEach(item => {  
    impacts.forEach(item => {  
        const val = item.val;
        // Scale the bar width arbitrarily for display (e.g., max width 100px)
        const width = Math.min(Math.abs(val) * 80, 300); //initially 40, 140
        const color = val > 0 ? teamA.primaryColor : teamB.primaryColor; // Green for Team A, Red for Team B
        const colorBorder = val > 0 ? '#FFFFFF' : '#FFFFFF'; // Green for Team A, Red for Team B
        
        // Flexbox trickery to align bars left/right of center        
        const leftBar = val < 0 ? `<div style="width:${width}px; height:14px; background:${color}; border: 1px solid ${colorBorder}; box-sizing: border-box; border-radius:4px 0 0 4px; margin-left:auto;"></div>` : '';
        const rightBar = val > 0 ? `<div style="width:${width}px; height:14px; background:${color}; border: 1px solid ${colorBorder}; box-sizing: border-box; border-radius:0 4px 4px 0; margin-right:auto;"></div>` : '';


        
        html += `
            <div style="display:flex; align-items:center; margin-bottom:4px;">
                <div style="flex:1; text-align:right; padding-right:5px;">${leftBar}</div>
                <div style="width:160px; text-align:center; font-size:16px; color:#eee;">${item.label}</div>
                <div style="flex:1; text-align:left; padding-left:5px;">${rightBar}</div>
            </div>`;
    });

    html += `</div>`;
    return html;
}


function renderAnalytics(summary, league) {
    const tbody = document.getElementById('analytics-stats-table-body');
    tbody.innerHTML = '';

    // 1. Calculate Impacts (The Heavy Lifting)
    const impacts = getMatchupImpacts(teamA, teamB, league);
    
    // 2. Generate Text & Visuals
    const keys = getKeysToSuccess(impacts, teamA, teamB);
    const tornadoHTML = renderTornadoChart(impacts, teamA, teamB);
    const frangibility = getFrangibility(summary.winProbA, summary.iqr);
    // Determine winner data first to avoid repeating long strings
    const isA = summary.winProbA >= summary.winProbB;
    const winner = isA ? teamA : teamB;
    const prob = isA ? summary.winProbA : summary.winProbB;
    
    const whoWins = `<strong>${winner.teamName}</strong> (${(prob * 100).toFixed(1)}%)<br>
                     Expected margin of victory of ${(((prob * 100).toFixed(0) - 50) / 3).toFixed(0)} points`;

    // 3. Build Table
    const rows = [
        { 
            label: "Who Wins?", 
            val: whoWins
        },
        { 
            label: "Keys to Victory", 
            val: `<ul style="margin: 0; padding-left: 15px;">
                    <li><strong>${teamA.teamId}:</strong> ${keys.teamA}</li>
                    <li><strong>${teamB.teamId}:</strong> ${keys.teamB}</li>
                  </ul>` 
        },
        { 
            label: "Matchup DNA", 
            val: `${tornadoHTML}<small style="color:#888; display:block; text-align:center;">Bar width = Impact on Sim Outcome</small>` 
        },
        { 
            label: "Risk Level", 
            val: `<span class="${frangibility.color}"><strong>${frangibility.label}</strong></span><br><small>${frangibility.desc}</small>` 
        }
    ];

    rows.forEach(r => {
        tbody.innerHTML += `<tr>
            <td style="width:30%; vertical-align:middle;"><strong>${r.label}</strong></td>
            <td>${r.val}</td>
        </tr>`;
    });

    if (typeof dropBalls === "function") dropBalls();
    
}

