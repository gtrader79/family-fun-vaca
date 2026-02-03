/* config.js 
    Holds constants and DOM IDs
*/

// 1. DOM ID Mappings Object (Change HTML IDs here, not in logic)
const DOM_IDS = {
    seasonSelect: 'season-select', 
    teamA: 'team-a-select',
    teamB: 'team-b-select',
    runBtn: 'run-sim-btn',
    mobileRunBtn: 'mobile-run-btn',
    resetBtn: 'reset-btn', 
    
    // Factors
    hfa: 'hfa-select',
    matchup: 'game-matchup-select',
    travel: 'travel-select',
    wind: 'winds-select',
    rain: 'rain-select',
    momentum: 'momentum-select',
    strngthOfSchdl: 'sos-select',

    //Rest by Team
    rest: {
        teamA: 'team-a-rest-select',
        teamB: 'team-b-rest-select'
    },
    
    // Injuries Team A
    injuriesA: {
        qb: 'team-a-qb-injury',
        rb: 'team-a-rb-injury',
        te: 'team-a-te-injury',
        wr: 'team-a-wr-injury',
        ol: 'team-a-olLine-injury',
        dl: 'team-a-dLine-injury',
        sec: 'team-a-dSecondary-injury'
    },
    
    // Injuries Team B
    injuriesB: {
        qb: 'team-b-qb-injury',
        rb: 'team-b-rb-injury',
        te: 'team-b-te-injury',
        wr: 'team-b-wr-injury',
        ol: 'team-b-olLine-injury',
        dl: 'team-b-dLine-injury',
        sec: 'team-b-dSecondary-injury'
    }
};

// 2. Simulation Constants Object
const SIM_CONFIG = {
    iterations: 10000,
    hfa_base: 0.05,          // Base Home Field Advantage
    travel_penalty: 0.03,    // Penalty for long travel
    momentum_val: 0.03,      // Momentum factor
    k: 0.65,                 // Sigmoid steepness (helps account for mid-game injury; mid game weather; bad calls)
    
    // Impact Weights
    weights: {
        passVolume: 0.30,
        rush: 0.85,
        qb: 0.55,
        wr: 0.20,
        te: 0.20,
        turnover: 1.50,
        redZone: 0.70,
        explosive: 0.40,
        pressure: 0.50
    },
    
    // Game Matchup Mappings (Spread adjustments)
    matchupMap: [1.0, 0.92, 0.90, 0.88, 0.85] 
};

// 3. Injury Logic Map
// Levels: 0 = Healthy, 1 = Questionable, 2 = Out
const INJURY_MAP = {
    // --- OFFENSIVE POSITIONS ---
    qb: {
        passVol: [1.0, 0.90, 0.75], // Backup QBs throw shorter/safer
        redZone:    [1.0, 0.88, 0.82], // Timing & processing drop
        explosive:  [1.0, 0.82, 0.65], // Deep ball arm talent/trust gap
        pressure:   [1.0, 1.10, 1.25]  // Backups hold ball longer (more sacks)
    },
    rb: {
        rushVol: [1.0, 0.97, 0.92], // Teams still run, but yards per carry dip
        passVol: [1.0, 0.98, 0.90], // Impacts check-down/safety valve utility
        explosive:  [1.0, 0.90, 0.80], // Home-run threat drops
        redZone:    [1.0, 0.95, 0.88], // Missing the "finisher" threat
        pressure:   [1.0, 1.05, 1.12]  // Blitz pickup assignment failures
    },
    wr: {
        passVol: [1.0, 0.95, 0.90], // Targets shift to lower-efficiency players
        redZone:    [1.0, 0.98, 0.95], // Moderate impact (TEs usually handle RZ)
        explosive:  [1.0, 0.88, 0.78]  // WR1 loss kills vertical stretching
    },
    te: {
        passVol: [1.0, 0.98, 0.95],
        redZone:    [1.0, 0.90, 0.80], // High impact: TEs are the RZ security blankets
        explosive:  [1.0, 0.97, 0.95],
        pressure:   [1.0, 1.03, 1.08]  // Loss of the "chip" block on edge rushers
    },
    olLine: {
        rushVol: [1.0, 0.95, 0.88], // Creating lanes is physical/talent-based
        passVol: [1.0, 0.97, 0.92], // Pocket collapses faster
        explosive:  [1.0, 0.92, 0.80], // No time for 3+ second deep routes
        redZone:    [1.0, 0.95, 0.90],
        pressure:   [1.0, 1.08, 1.22]  // Direct spike in pressure allowed
    },

    // --- DEFENSIVE POSITIONS (Resistance Approach) ---
    dLine: {
        pressureDef:   [1.0, 0.95, 0.85], // Sacks/Hurries generated drop (fewer sacks)
        rushDef:    [1.0, 1.05, 1.12]  // Increase in yards allowed to opponent
    },
    secondary: {
        passDef: [1.0, 1.04, 1.10], // More passing yards allowed per game
        explosiveDef:[1.0, 1.08, 1.18] // Higher rate of big plays surrendered
    }
};