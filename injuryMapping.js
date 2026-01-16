/**
 * Returns the positional injury multipliers based on historical EPA and 
 * success rate data (2015-2025).
 * Levels: 0 = Healthy, 1 = Questionable/Mild, 2 = Out
 */
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


const getAdjustedTeamStats = (teamStats, injuries, ctx) => {
    let adjusted = { ...teamStats };

    let mults = {
        passVol: 1.0, rushVol: 1.0, redZone: 1.0, explosive: 1.0, pressureAllowed: 1.0,
        pressureGenerated: 1.0, rushDef: 1.0, passDef: 1.0, explosiveDef: 1.0
    };

    let counts = { olOut: 0, cbOut: 0, sOut: 0, cb1Out: false, cb2Out: false, s1Out: false };

    // PHASE 1: Process Individual Injuries
    injuries.forEach(inj => {
        const { pos, level, role } = inj;
        if (level === 0) return;

        const map = INJURY_MAP[pos];
        if (!map) return;

        if (pos === 'qb') {
            mults.passVol *= map.passVol[level];
            mults.redZone *= map.redZone[level];
            mults.explosive *= map.explosive[level];
            mults.pressureAllowed *= map.pressure[level];
        } 
        else if (pos === 'rb') {
            mults.rushVol *= map.rushVol[level];
            mults.passVol *= map.passVol[level];
            mults.explosive *= map.explosive[level];
            mults.redZone *= map.redZone[level];
            mults.pressureAllowed *= map.pressure[level];
        } 
        else if (pos === 'wr') {
            mults.passVol *= map.passVol[level];
            mults.redZone *= map.redZone[level];
            mults.explosive *= map.explosive[level];
        } 
        else if (pos === 'te') {
            mults.passVol *= map.passVol[level];
            mults.redZone *= map.redZone[level];
            mults.explosive *= map.explosive[level];
            mults.pressureAllowed *= map.pressure[level];
        } 
        else if (pos === 'olLine') {
            mults.rushVol *= map.rushVol[level];
            mults.passVol *= map.passVol[level];
            mults.explosive *= map.explosive[level];
            mults.redZone *= map.redZone[level];
            mults.pressureAllowed *= map.pressure[level];
            if (level === 2) counts.olOut++; 
        } 
        else if (pos === 'dLine') {
            mults.pressureGenerated *= map.pressureDef[level];
            mults.rushDef *= map.rushDef[level];            
        } 
        else if (pos === 'secondary') {
            mults.passDef *= map.passDef[level];
            mults.explosiveDef *= map.explosiveDef[level];
            if (level === 2) {
                if (role === 'CB1') counts.cb1Out = true;
                if (role === 'CB2') counts.cb2Out = true;
                if (role === 'S1')  counts.s1Out = true;
            }
        }
    });

    // PHASE 2: Apply "Cliffs"
    
    // OL Cliff: If 3+ Starters are OUT
    if (counts.olOut >= 3) {
        mults.passVol *= 0.85;       
        mults.pressureAllowed *= 1.25; 
        mults.explosive *= 0.80;    
    }

    // Secondary Cliff: (CB1 + CB2 Out) OR (CB1 + S1 Out)
    const secondaryCollapse = (counts.cb1Out && counts.cb2Out) || (counts.cb1Out && counts.s1Out);
    if (secondaryCollapse) {
        mults.explosiveDef *= 1.15; 
        mults.passDef *= 1.08;      
    }

    // --- PHASE 3: Apply WIND (New!) ---
    // Wind primarily kills passing volume and deep explosives
    if (ctx.windLevel === 1) { // Medium Wind
        mults.passVol *= 0.95; 
        mults.explosive *= 0.90;
    } else if (ctx.windLevel === 2) { // High Wind
        mults.passVol *= 0.85; 
        mults.explosive *= 0.75;
        // Note: We don't boost rushing, we just suppress passing, which naturally makes rushing a larger % of the "Delta"
    }

    // --- PHASE 4: Final Math (Resistance)---
    if (adjusted.off_pass_yards_per_game) adjusted.off_pass_yards_per_game *= mults.passVol;
    if (adjusted.off_rush_yards_per_game) adjusted.off_rush_yards_per_game *= mults.rushVol;
    if (adjusted.off_rz_efficiency_pct) adjusted.off_rz_efficiency_pct *= mults.redZone;
    if (adjusted.off_explosive_play_rate_pct) adjusted.off_explosive_play_rate_pct *= mults.explosive;
    if (adjusted.off_pressure_allowed_pct) adjusted.off_pressure_allowed_pct *= mults.pressureAllowed;


    if (adjusted.def_pressure_generated_pct) adjusted.def_pressure_generated_pct *= mults.pressureGenerated;
    if (adjusted.def_rush_yards_allowed_per_game) adjusted.def_rush_yards_allowed_per_game *= mults.rushDef;
    if (adjusted.def_pass_yards_allowed_per_game) adjusted.def_pass_yards_allowed_per_game *= mults.passDef;
    if (adjusted.def_explosive_play_rate_allowed_pct) adjusted.def_explosive_play_rate_allowed_pct *= mults.explosiveDef;

    return adjusted;
};




// --- 3. Inputs & Setup ---
const getSituationalFactors = () => {
    const sVal = (id) => parseInt(document.getElementById(id)?.value || 0);

    return {
        context: {
            hfa: sVal('hfa-select'),                                
            travel: sVal('travel-select'),                          
            windLevel: sVal('winds-select'),                        
            momentum: sVal('momentum-select'),                      
            divisionMatchUp: (teamA.division === teamB.division),
            gameMatchUpType: sVal('game-matchup-select'),
            gameMatchUpMapping: [1.0, 0.92, 0.90, 0.88, 0.85]  
        },
        injuriesA: {
            qb: sVal('team-a-qb-injury'),
            rb: sVal('team-a-rb-injury'),
            te: sVal('team-a-te-injury'),
            wr: sVal('team-a-wr-injury'),
            olLine: sVal('team-a-olLine-injury'), // NEW: Ensure you add this ID to your HTML
            dLine: sVal('team-a-dLine-injury'),
            dSecondary: sVal('team-a-dSecondary-injury')
        },
        injuriesB: {
            qb: sVal('team-b-qb-injury'),
            rb: sVal('team-b-rb-injury'),
            te: sVal('team-b-te-injury'),
            wr: sVal('team-b-wr-injury'),
            olLine: sVal('team-b-olLine-injury'), // NEW
            dLine: sVal('team-b-dLine-injury'),
            dSecondary: sVal('team-b-dSecondary-injury')
        }
    };
};




