/* logic.js */

// --- 1. Global State & Constants ---
let globalData = null;
let currentSeasonData = null;
let teamA = null;
let teamB = null;
let results = [];
let simulationRuns = [];

const SIM_CONFIG = {
    iterations: 10000,
    hfa: 0.037878,      //z score based on 2 Pts of historical HFA; historical Mean Spread of 2.5 pts; historical StdDev of 13.2 points.  Historical is Post 1990
    k: 0.7,
    weights: { pass: 1.0, rush: 0.85 },
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

// --- 4. UI: Update Comparison Table ---
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
        { label: "Points Scored", key: "off_points_scored_per_game", r: "off_points_scored_per_game_rank" },
        { label: "Pass Yds", key: "off_pass_yards_per_game", r: "off_pass_yards_per_game_rank" },
        { label: "Rush Yds", key: "off_rush_yards_per_game", r: "off_rush_yards_per_game_rank" },
        { label: "Points Allowed", key: "def_points_allowed_per_game", r: "def_points_allowed_per_game_rank" },
        { label: "Def Pass Yds Allowed", key: "def_pass_yards_allowed_per_game", r: "def_pass_yards_allowed_per_game_rank" },
        { label: "Def Rush Yds Allowed", key: "def_rush_yards_allowed_per_game", r: "def_rush_yards_allowed_per_game_rank" }
    ];

    const tbody = document.getElementById('stats-table-body');
    tbody.innerHTML = `<tr><td>Record</td><td>${teamA.wins}-${teamA.losses}</td><td>${teamB.wins}-${teamB.losses}</td></tr>`;
    
    metrics.forEach((m, i) => {
        if (i === 0) {
            tbody.innerHTML +=`<tr><td style="padding-left:20px">Offense</td><td></td><td></td></tr>`;
        } else if (i === 3) {
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

    // A. Pre-calculate League Stats (Context)
    const league = {
        offPass: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_pass_yards_per_game)),
        offRush: mathUtils.getStats(currentSeasonData.teams.map(t => t.off_rush_yards_per_game)),
        defPass: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_pass_yards_allowed_per_game)),
        defRush: mathUtils.getStats(currentSeasonData.teams.map(t => t.def_rush_yards_allowed_per_game))
    };

    // B. Calculate Matchup Z-Scores
    const getMatchupDelta = (tA, tB, noise) => {
        const pAdv = (mathUtils.getZ(tA.off_pass_yards_per_game, league.offPass) + mathUtils.generateNoise(noise)) 
                   - (mathUtils.getZ(tB.def_pass_yards_allowed_per_game, league.defPass, true) + mathUtils.generateNoise(noise));
        const rAdv = (mathUtils.getZ(tA.off_rush_yards_per_game, league.offRush) + mathUtils.generateNoise(noise)) 
                   - (mathUtils.getZ(tB.def_rush_yards_allowed_per_game, league.defRush, true) + mathUtils.generateNoise(noise));
        return (pAdv * SIM_CONFIG.weights.pass) + (rAdv * SIM_CONFIG.weights.rush);
    };

    // C. The Simulation Loop
    let totalProbA = 0;    
    for (let i = 0; i < SIM_CONFIG.iterations; i++) {
        //1. Calculat simulated results and delta for this 'any given sunday' simulated run
        const strA = getMatchupDelta(teamA, teamB, SIM_CONFIG.noiseThreshold) + SIM_CONFIG.hfa;
        const strB = getMatchupDelta(teamB, teamA, SIM_CONFIG.noiseThreshold);
        const delta = strA - strB;
        //2. Map this delta to a Probability using Sigmoid
        const probA = mathUtils.sigmoid(delta);
        //3. Accumulate and Store
        totalProbA += probA;
        results.push(strA - strB);   
        //4. Store in Simulation for Visual.js
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
        //4. Calculate Win Probabilities by averaging the probabilities
        const winProbA = totalProbA / SIM_CONFIG.iterations;    
        const winProbB = 1 - winProbA;
        results.sort((a, b) => a - b);

    // D. Process Results
    const summary = {
        //winProbA: results.filter(d => d > 0).length / SIM_CONFIG.iterations,
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
    const winMargin = Math.abs(winProbA - 0.5);
    
    // High Fragility: The game is close (within 6% of a coin flip) 
    // AND the volatility (IQR) is high (over 1.2 standard units).
    if (winMargin < 0.06 && iqr > 1.2) {
        return { label: "High (Fragile)", color: "text-danger", desc: "A single bounce could flip the result." };
    } 
    
    // Low (Stable): One team has a clear advantage (>12% margin)
    // AND the variance is relatively tight.
    if (winMargin > 0.12 && iqr < 1.0) {
        return { label: "Low (Stable)", color: "text-success", desc: "Team strength is likely to overcome random noise." };
    }
    
    // Default
    return { label: "Moderate", color: "text-warning", desc: "Standard NFL variance applies." };
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

function getXFactor(tA, tB, league) {
    const matchups = [
        {
            name: "Passing Matchup",
            // How much Team A's passing exceeds Team B's pass defense
            gap: Math.abs(mathUtils.getZ(tA.off_pass_yards_per_game, league.offPass) - 
                 mathUtils.getZ(tB.def_pass_yards_allowed_per_game, league.defPass, true)),
            desc: `the aerial battle between ${tA.teamId} and the ${tB.teamId} secondary.`
        },
        {
            name: "Ground War",
            // How much Team A's rushing exceeds Team B's rush defense
            gap: Math.abs(mathUtils.getZ(tA.off_rush_yards_per_game, league.offRush) - 
                 mathUtils.getZ(tB.def_rush_yards_allowed_per_game, league.defRush, true)),
            desc: `how ${tA.teamId}'s run game matches up with the ${tB.teamId} front seven.`
        },
        {
            name: "Scoring Efficiency",
            gap: Math.abs(mathUtils.getZ(tA.off_points_scored_per_game, league.offPass) - 
                 mathUtils.getZ(tB.def_points_allowed_per_game, league.defPass, true)),
            desc: `the efficiency of ${tA.teamId} finding the endzone against ${tB.teamId}.`
        }
    ];

    // Sort by the 'gap' descending to find the biggest outlier
    matchups.sort((a, b) => b.gap - a.gap);
    return matchups[0];
}

function getKeysToSuccess(tA, tB, league) {
    // Helper to see how much better/worse a team is than the opponent in a category
    const getAdvantage = (offVal, offLeague, defVal, defLeague) => {
        return mathUtils.getZ(offVal, offLeague) - mathUtils.getZ(defVal, defLeague, true);
    };

    const keys = { teamA: "", teamB: "" };

    // Logic for Team A
    const aPassAdv = getAdvantage(tA.off_pass_yards_per_game, league.offPass, tB.def_pass_yards_allowed_per_game, league.defPass);
    const aRushAdv = getAdvantage(tA.off_rush_yards_per_game, league.offRush, tB.def_rush_yards_allowed_per_game, league.defRush);

    if (aPassAdv > aRushAdv) {
        keys.teamA = `${tA.teamName} should focus on their passing game to exploit the ${tB.teamId} secondary.`;
    } else {
        keys.teamA = `${tA.teamName} needs to lean on their rushing attack to control the tempo against ${tB.teamId}.`;
    }

    // Logic for Team B (Defensive Focus)
    const bPassDefend = getAdvantage(tB.off_pass_yards_per_game, league.offPass, tA.def_pass_yards_allowed_per_game, league.defPass);
    
    // We check what Team A's biggest threat is and tell Team B to stop it
    if (aPassAdv > aRushAdv) {
        keys.teamB = `${tB.teamName} must limit the ${tA.teamId} air-attack to stay in this game.`;
    } else {
        keys.teamB = `${tB.teamName} has to stack the box and stop ${tA.teamId} from running the ball effectively.`;
    }

    return keys;
}

// --- 7 The Analyst: Render ---
function renderAnalytics(summary, league) {
    const tbody = document.getElementById('analytics-stats-table-body');
    tbody.innerHTML = '';

    const isAUnderdog = summary.winProbA < 0.5;
    const upsetRate = isAUnderdog ? summary.winProbA : (1 - summary.winProbA);
    const underdogName = isAUnderdog ? teamA.teamName : teamB.teamName;

    const xFactor = getXFactor(teamA, teamB, league);
    const frangibility = getFrangibility(summary.winProbA, summary.iqr);
    const confidenceLabel = getConfidenceLabel(summary.winProbA, summary.iqr, upsetRate);
    const keys = getKeysToSuccess(teamA, teamB, league);

    const rows = [
        { 
            label: "Who Wins?", 
            val: `<strong>${teamA.teamName}</strong> has a <strong>${(summary.winProbA * 100).toFixed(1)}%</strong> chance to win.<br><strong>${teamB.teamName}</strong> has a <strong>${(summary.winProbB * 100).toFixed(1)}%</strong> chance to win.`
        },
        { 
            label: "Matchup Stability", 
            val: `<span class="${frangibility.color}"><strong>${frangibility.label}</strong></span><br><small>${frangibility.desc}</small>` 
        },
        { 
            label: "Key X-Factor", 
            val: `<strong>${xFactor.name}</strong><br><small>The sim is most sensitive to ${xFactor.desc}</small>` 
        },
        { 
            label: "Upset Potential", 
            val: `<strong>${(upsetRate * 100).toFixed(1)}%</strong><br><small>${underdogName} win paths identified.</small>` 
        },
        { 
            label: "Sim Confidence", 
            val: `<strong>${confidenceLabel}</strong><br><small>Based on ${SIM_CONFIG.iterations.toLocaleString()} runs</small>` 
        },
        { 
            label: "Key to Victory", 
            val: `<strong>For ${teamA.teamId}:</strong> ${keys.teamA}<br><strong>For ${teamB.teamId}:</strong> ${keys.teamB}` 
        },
        { 
            label: "Game Style", 
            val: `This matchup looks <strong>${frangibility.label}</strong>. ${frangibility.desc}` 
        },
        { 
            label: "Upset Watch", 
            val: `The underdog wins about <strong>${(Math.min(summary.winProbA, 1-summary.winProbA) * 100).toFixed(0)} out of 100</strong> times.` 
        }
        
    ];

    rows.forEach(r => {
        tbody.innerHTML += `<tr>
            <td style="width:35%"><strong>${r.label}</strong></td>
            <td>${r.val}</td>
        </tr>`;
    });

    if (typeof dropBalls === "function") dropBalls();
}

