/* logic.js */

// --- 1. Global State & Constants ---
let globalData = null;
let currentSeasonData = null;
let teamA = null;
let teamB = null;
let results = [];

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
            <td style="padding-left:20px">${m.label}</td>
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
    }
        //4. Calculate Win Probabilities by averaging the probabilities
        const winProbA = totalProbA / SIM_CONFIG.iterations;    
        const winProbB = 1 - winProbA;
        results.sort((a, b) => a - b);

    // D. Process Results
    const summary = {
        //winProbA: results.filter(d => d > 0).length / SIM_CONFIG.iterations,
        winProbA = winProbA;
        winProbB = winProbB;
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

// --- 6. The Analyst: Interpret and Render ---
function renderAnalytics(summary, league) {
    const tbody = document.getElementById('analytics-stats-table-body');
    tbody.innerHTML = '';

    // 1. Confidence Logic
    const floor = summary.p2_5.toFixed(2), ceil = summary.p97_5.toFixed(2);
    let confText = (summary.p2_5 > 0) ? `${teamA.teamName} by ${floor} to ${ceil}` :
                   (summary.p97_5 < 0) ? `${teamB.teamName} by ${Math.abs(ceil)} to ${Math.abs(floor)}` :
                   `Toss-up: ${teamB.teamName} (-${Math.abs(floor)}) to ${teamA.teamName} (+${ceil})`;

    // 2. Frangibility Logic
    const winMargin = Math.abs(summary.winProbA - 0.5);
    let stability = { label: "Moderate", color: "text-warning" };
    if (winMargin < 0.07 && summary.iqr > 1.5) stability = { label: "High (Fragile)", color: "text-danger" };
    else if (winMargin > 0.15) stability = { label: "Low (Stable)", color: "text-success" };

    // 3. X-Factor Logic
    const gaps = [
        { n: "Passing Matchup", v: Math.abs(mathUtils.getZ(teamA.off_pass_yards_per_game, league.offPass) - mathUtils.getZ(teamB.def_pass_yards_allowed_per_game, league.defPass, true)) },
        { n: "Rushing Matchup", v: Math.abs(mathUtils.getZ(teamA.off_rush_yards_per_game, league.offRush) - mathUtils.getZ(teamB.def_rush_yards_allowed_per_game, league.defRush, true)) }
    ].sort((a,b) => b.v - a.v);

    // 4. Calculate Underdog/Upset Rate
    // We assume the team with < 50% win prob is the underdog in the sim
    const isAUnderdog = summary.winProbA < 0.5;
    const upsetRate = isAUnderdog ? summary.winProbA : (1 - summary.winProbA);
    const underdogName = isAUnderdog ? teamA.teamName : teamB.teamName;

    // 5. Build the Narratives using our Analysis Utils
    const medianText = analysisUtils.interpretMedianDelta(summary.medianDelta, teamA.teamName, teamB.teamName);
    const stabilityText = analysisUtils.interpretStability(summary.p25, summary.p75, summary.p10, summary.p90);
    const upsetText = analysisUtils.interpretUpset(upsetRate);

    //6. Final Confidence Label
    const confidenceLabel = getConfidenceLabel(summary.winProbA, summary.iqr, upsetRate);
    
    const rows = [
        ["Win Probability", `<strong>${(summary.winProbA * 100).toFixed(1)}%</strong> for ${teamA.teamName}; <strong>${((1-summary.winProbA) * 100).toFixed(1)}%</strong> for ${teamB.teamName}`],
        ["95% Confidence", confText],
        ["Matchup Stability", `<span class="${stability.color}">${stability.label}</span>`],
        ["Key X-Factor", `The simulation is most sensitive to the <strong>${gaps[0].n}</strong>.`],
        ["Typical Strength", `${medianText} <br><small>(Median Δ: ${summary.medianDelta.toFixed(2)})</small>`],
        ["Outcome Stability", `${stabilityText} <br><small>(Middle 50% range: ${summary.p25.toFixed(2)} to ${summary.p75.toFixed(2)})</small>`],
        ["Upset Potential", `${upsetText} <br><small>${underdogName} wins ${(upsetRate * 100).toFixed(1)}% of the time.</small>` ],
        ["Overall Confidence", `<strong>${confidenceLabel}</strong>`]
    ];

    rows.forEach(r => {
        tbody.innerHTML += `<tr><td style="width:35%"><strong>${r[0]}</strong></td><td>${r[1]}</td></tr>`;
    });

    if (typeof dropBalls === "function") dropBalls();
}


// Separate helper for the Confidence Label to keep things tidy
function getConfidenceLabel(winProb, iqr, upsetRate) {
    if (upsetRate > 0.40 || iqr > 1.5) return "Volatile";
    if (winProb > 0.70 && iqr < 0.8) return "Strong Favorite";
    if (winProb > 0.60) return "Moderate Favorite";
    if (winProb > 0.52) return "Slight Edge";
    if (winProb >= 0.48 && winProb <= 0.52) return "Coin Flip";
    return "Unclear Edge";
}
