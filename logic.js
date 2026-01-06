/* logic.js */

// --- 1. Global State & Constants ---
let globalData = null;
let currentSeasonData = null;
let teamA = null;
let teamB = null;

const SIM_CONFIG = {
    iterations: 10000,
    hfa: 0.1095,
    k: 0.7,
    weights: { pass: 1.0, rush: 0.85 },
    noiseThreshold: 0.05 // Baseline "Stable"
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
        { label: "Def Pass Yds", key: "def_pass_yards_allowed_per_game", r: "def_pass_yards_allowed_per_game_rank" },
        { label: "Def Rush Yds", key: "def_rush_yards_allowed_per_game", r: "def_rush_yards_allowed_per_game_rank" }
    ];

    const tbody = document.getElementById('stats-table-body');
    tbody.innerHTML = `<tr><td>Record</td><td>${teamA.wins}-${teamA.losses}</td><td>${teamB.wins}-${teamB.losses}</td></tr>`;
    
    metrics.forEach(m => {
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
    let results = [];
    for (let i = 0; i < SIM_CONFIG.iterations; i++) {
        const strA = getMatchupDelta(teamA, teamB, SIM_CONFIG.noiseThreshold) + SIM_CONFIG.hfa;
        const strB = getMatchupDelta(teamB, teamA, SIM_CONFIG.noiseThreshold);
        results.push(strA - strB);
    }
    results.sort((a, b) => a - b);

    // D. Process Results
    const summary = {
        winProbA: results.filter(d => d > 0).length / SIM_CONFIG.iterations,
        p2_5: mathUtils.getPercentile(results, 2.5),
        p25: mathUtils.getPercentile(results, 25),
        p75: mathUtils.getPercentile(results, 75),
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

    const rows = [
        ["Win Probability", `<strong>${(summary.winProbA * 100).toFixed(1)}%</strong> for ${teamA.teamName}`],
        ["95% Confidence", confText],
        ["Matchup Stability", `<span class="${stability.color}">${stability.label}</span>`],
        ["Key X-Factor", `The simulation is most sensitive to the <strong>${gaps[0].n}</strong>.`]
    ];

    rows.forEach(r => {
        tbody.innerHTML += `<tr><td style="width:35%"><strong>${r[0]}</strong></td><td>${r[1]}</td></tr>`;
    });

    if (typeof dropBalls === "function") dropBalls();
}
