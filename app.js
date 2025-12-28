/* ============================================================
   NFL Monte Carlo Matchup Simulator
   app.js — SINGLE SOURCE OF TRUTH

   Spec References:
   - Section X  : Simulation Execution Order
   - Section V  : Visualization Contract
   - Section W  : Layout & Interaction
   - Section AF : Team Stats Research View
   - Section AE : Determinism & Guardrails
   ============================================================ */


/* ============================================================
   GLOBAL APPLICATION STATE
   ============================================================ */

let simulationResults = [];
let aggregateResults = null;
let simulationState = "idle";

let rng = null;
let activeSeed = null;
let animationPaused = false;

/* ============================================================
   BALL DROP LIFECYCLE STATE — SECTION V
   ============================================================ */

let activeFallingBalls = 0;
let ballDropInProgress = false;
let ballDropIndex = 0;


/* ============================================================
   RNG — DETERMINISTIC (SECTION AB)
   ============================================================ */

function createSeededRNG(seed) {
    let state = seed >>> 0;
    return function () {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0xFFFFFFFF;
    };
}


/* ============================================================
   CONTROL PANEL — DOM CREATION (SECTION W.3)
   ============================================================ */

function createNumberInput(id, label, min, max) {
    const wrapper = document.createElement("div");

    const l = document.createElement("label");
    l.textContent = label;
    l.htmlFor = id;

    const input = document.createElement("input");
    input.type = "number";
    input.id = id;
    input.min = min;
    input.max = max;

    wrapper.appendChild(l);
    wrapper.appendChild(input);
    return wrapper;
}

function mountControlPanel() {
    const teamA = document.querySelector("#team-a-controls .control-section-body");
    const teamB = document.querySelector("#team-b-controls .control-section-body");
    const variance = document.querySelector("#variance-controls .control-section-body");

    [
        ["rushOff", "Rush Offense Rank"],
        ["passOff", "Pass Offense Rank"],
        ["rushDef", "Rush Defense Rank"],
        ["passDef", "Pass Defense Rank"]
    ].forEach(([key, label]) => {
        teamA.appendChild(createNumberInput(`A-${key}`, label, 1, 32));
        teamB.appendChild(createNumberInput(`B-${key}`, label, 1, 32));
    });

    variance.appendChild(createNumberInput("run-count", "Simulation Runs", 1, 100000));
    variance.appendChild(createNumberInput("baseline-variance", "Baseline Variance", 0, 100));
    variance.appendChild(createNumberInput("variance-min", "Variance Min", 0, 100));
    variance.appendChild(createNumberInput("variance-max", "Variance Max", 0, 100));
    variance.appendChild(createNumberInput("seed", "Random Seed", 0, 999999999));
}


/* ============================================================
   INPUT SNAPSHOT — AUTHORITATIVE (SECTION X.1)
   ============================================================ */

function readValue(id) {
    const el = document.getElementById(id);
    return el ? Number(el.value) : null;
}

function captureInputSnapshot() {
    return {
        teamA: {
            ranks: {
                rushOffense: readValue("A-rushOff"),
                passOffense: readValue("A-passOff"),
                rushDefense: readValue("A-rushDef"),
                passDefense: readValue("A-passDef")
            }
        },
        teamB: {
            ranks: {
                rushOffense: readValue("B-rushOff"),
                passOffense: readValue("B-passOff"),
                rushDefense: readValue("B-rushDef"),
                passDefense: readValue("B-passDef")
            }
        },
        global: {
            runCount: readValue("run-count"),
            baselineVariance: readValue("baseline-variance"),
            varianceBounds: {
                min: readValue("variance-min"),
                max: readValue("variance-max")
            },
            seed: readValue("seed")
        }
    };
}


/* ============================================================
   SIMULATION CORE — SECTION X
   ============================================================ */

function normalizeRank(rank) {
    return (16.5 - rank) / 15.5;
}

function runSingleSimulation(input, runIndex) {
    const A = input.teamA.ranks;
    const B = input.teamB.ranks;

    const A_off =
        normalizeRank(A.rushOffense) - normalizeRank(B.rushDefense) +
        normalizeRank(A.passOffense) - normalizeRank(B.passDefense);

    const B_off =
        normalizeRank(B.rushOffense) - normalizeRank(A.rushDefense) +
        normalizeRank(B.passOffense) - normalizeRank(A.passDefense);

    const baseVar = input.global.baselineVariance;
    const varMin = input.global.varianceBounds.min;
    const varMax = input.global.varianceBounds.max;

    const variance = Math.min(Math.max(baseVar, varMin), varMax);

    const A_realized = A_off + (rng() * 2 - 1) * variance;
    const B_realized = B_off + (rng() * 2 - 1) * variance;

    let winner = "A";
    if (A_realized < B_realized) winner = "B";
    if (A_realized === B_realized) winner = rng() < 0.5 ? "A" : "B";

    return {
        runIndex,
        teamA_strength: A_realized,
        teamB_strength: B_realized,
        differential: A_realized - B_realized,
        winner
    };
}

function runSimulation() {
    if (simulationState !== "idle") return;

    simulationState = "running";
    simulationResults = [];
    aggregateResults = null;

    const snapshot = captureInputSnapshot();
    activeSeed = snapshot.global.seed;
    rng = createSeededRNG(activeSeed);

    for (let i = 0; i < snapshot.global.runCount; i++) {
        simulationResults.push(runSingleSimulation(snapshot, i));
    }

    finalizeAggregates();
    simulationState = "complete";

    document.dispatchEvent(new CustomEvent("simulationComplete"));
}

function finalizeAggregates() {
    let A = 0, B = 0;
    const diffs = [];

    simulationResults.forEach(r => {
        r.winner === "A" ? A++ : B++;
        diffs.push(r.differential);
    });

    aggregateResults = {
        totalRuns: simulationResults.length,
        teamA_wins: A,
        teamB_wins: B,
        teamA_pct: A / simulationResults.length,
        teamB_pct: B / simulationResults.length,
        differentials: diffs,
        seed: activeSeed
    };
}

function resetSimulation() {
    simulationState = "idle";
    simulationResults = [];
    aggregateResults = null;
    rng = null;
    activeSeed = null;
    animationPaused = false;

    document.dispatchEvent(new CustomEvent("simulationReset"));

    //Applied to chart.js
    if (distributionChart) {
        distributionChart.destroy();
        distributionChart = null;
    }
}


function computeWinPercentages(results) {
    const total = results.length;

    const teamAWins = results.filter(r => r.winner === "A").length;
    const teamBWins = results.filter(r => r.winner === "B").length;

    return {
        teamA: total > 0 ? teamAWins / total : 0,
        teamB: total > 0 ? teamBWins / total : 0
    };
}


/* ============================================================
   TEAM STATS — SECTION AF (READ-ONLY)
   ============================================================ */

let teamStatsData = null;
let teamStatsSortKey = null; // reserved for later phases
let teamStatsSortAsc = true;

const TEAM_STATS_CONFIG = [
  { key: "off_pass_yards_per_game", rankKey: "off_pass_yards_per_game_rank", label: "Offensive Passing Yds / Gm" },
  { key: "off_rush_yards", rankKey: "off_rush_yards_rank", label: "Offensive Rushing Yds" },
  { key: "off_rush_yards_per_game", rankKey: "off_rush_yards_per_game_rank", label: "Offensive Rushing Yds / Gm" },
  { key: "off_total_yards", rankKey: "off_total_yards_rank", label: "Offensive Total Yds" },
  { key: "off_total_yards_per_game", rankKey: "off_total_yards_per_game_rank", label: "Offensive Total Yds / Gm" },
  { key: "off_points_scored_per_game", rankKey: "off_points_scored_per_game_rank", label: "Points Scored / Gm" },

  { key: "def_pass_yards_allowed_per_game", rankKey: "def_pass_yards_allowed_per_game_rank", label: "Passing Yds Allowed / Gm" },
  { key: "def_rush_yards_allowed_per_game", rankKey: "def_rush_yards_allowed_per_game_rank", label: "Rushing Yds Allowed / Gm" },
  { key: "def_total_yards_allowed_per_game", rankKey: "def_total_yards_allowed_per_game_rank", label: "Total Yds Allowed / Gm" },
  { key: "def_points_allowed_per_game", rankKey: "def_points_allowed_per_game_rank", label: "Points Allowed / Gm" }
];

function formatOrdinal(n) {
  if (n == null) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function isHeadToHeadMode() {
  const teamA = document.getElementById("team-a-select").value;
  const teamB = document.getElementById("team-b-select").value;
  return teamA && teamB;
}

function getSelectedSeason() {
  const select = document.getElementById("season-select");
  return parseInt(select.value, 10);
}

/* ===============================
   DATA LOAD
   =============================== */

async function loadTeamStats() {
  try {
    const res = await fetch("teams.json");
    if (!res.ok) throw new Error("HTTP");

    const json = await res.json();
    teamStatsData = json.seasons;

    populateSeasonSelector(json.seasons);
    populateTeamSelectors(json.seasons);

    wireTeamStatsControls();
    renderTeamStatsTable(); // initial render

  } catch {
    document.getElementById("team-stats-error").hidden = false;
  }
}

/* ===============================
   Event Listener - wiring
   =============================== */
function wireTeamStatsControls() {
  const seasonSelect = document.getElementById("season-select");
  const teamASelect = document.getElementById("team-a-select");
  const teamBSelect = document.getElementById("team-b-select");

  seasonSelect.addEventListener("change", renderTeamStatsTable);
  teamASelect.addEventListener("change", renderTeamStatsTable);
  teamBSelect.addEventListener("change", renderTeamStatsTable);
}

/* ===============================
   Helper function: Season
   =============================== */
function populateSeasonSelector(seasons) {
  const select = document.getElementById("season-select");
  select.innerHTML = "";

  const sorted = [...seasons].sort((a, b) => b.season - a.season);

  sorted.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.season;
    opt.textContent = s.season;
    select.appendChild(opt);
  });

  select.value = sorted[0].season; // default = latest
}

/* ===============================
   Helper function: Teams
   =============================== */
function populateTeamSelectors(seasons) {
  const teamA = document.getElementById("team-a-select");
  const teamB = document.getElementById("team-b-select");

  teamA.innerHTML = `<option value="">— Select Team A —</option>`;
  teamB.innerHTML = `<option value="">— Select Team B —</option>`;

  const season = Math.max(...seasons.map(s => s.season));
  const seasonData = seasons.find(s => s.season === season);

  seasonData.teams.forEach(team => {
    const optA = document.createElement("option");
    optA.value = team.teamId;
    optA.textContent = team.teamName;

    const optB = optA.cloneNode(true);

    teamA.appendChild(optA);
    teamB.appendChild(optB);
  });
}

/* ===============================
   RENDERING
   =============================== */

function renderTeamStatsTable() {
  const container = document.getElementById("team-stats-table-container");
  container.innerHTML = "";

  /*Empty State*/
    if (!isHeadToHeadMode()) {
      const note = document.createElement("div");
      note.className = "team-stats-empty";
      note.textContent =
        "Select both Team A and Team B to enter head-to-head comparison mode.";
      container.appendChild(note);
    }
    
  const season = getSelectedSeason();
  const seasonData = teamStatsData.find(s => s.season === season);
  if (!seasonData) return;

  const teams = seasonData.teams;
  const headToHead = isHeadToHeadMode();

  const table = document.createElement("table");
  table.className = "team-stats-table";

  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  /* Header */
  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th")).textContent = "Metric";

  if (headToHead) {
    headerRow.appendChild(document.createElement("th")).textContent =
      document.getElementById("team-a-select").value;
    headerRow.appendChild(document.createElement("th")).textContent =
      document.getElementById("team-b-select").value;
  } else {
    headerRow.appendChild(document.createElement("th")).textContent = "League Average";
  }

  thead.appendChild(headerRow);

  /* Rows */
  TEAM_STATS_CONFIG.forEach(stat => {
    const row = document.createElement("tr");
    row.appendChild(document.createElement("td")).textContent =
      `${stat.label} (Rank)`;

    if (headToHead) {
      const teamA = teams.find(t => t.teamId === document.getElementById("team-a-select").value);
      const teamB = teams.find(t => t.teamId === document.getElementById("team-b-select").value);

      row.appendChild(document.createElement("td")).textContent =
        `${teamA[stat.key]} (${formatOrdinal(teamA[stat.rankKey])})`;

      row.appendChild(document.createElement("td")).textContent =
        `${teamB[stat.key]} (${formatOrdinal(teamB[stat.rankKey])})`;

    } else {
      const avg =
        teams.reduce((sum, t) => sum + (t[stat.key] ?? 0), 0) / teams.length;
      row.appendChild(document.createElement("td")).textContent = avg.toFixed(2);
    }

    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);

  const note = document.createElement("div");
  note.className = "team-stats-note";
  note.textContent = "Lower rank indicates better league performance.";
  container.appendChild(note);
}



/* ============================================================
   TAB SWITCHING — SECTION W.4
   ============================================================ */

function initializeTabs() {
    const buttons = document.querySelectorAll(".tab-button");
    const tabs = document.querySelectorAll(".tab-content");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab;

            buttons.forEach(b => b.classList.remove("active"));
            tabs.forEach(t => t.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(target).classList.add("active");
        });
    });
}

/* ============================================================
   BUTTON STATE MANAGEMENT — SECTION W
   ============================================================ */

function setButtonState({ run, pause, reset }) {
    const runBtn = document.getElementById("run-simulation-btn");
    const pauseBtn = document.getElementById("pause-simulation-btn");
    const resetBtn = document.getElementById("reset-simulation-btn");

    if (run !== undefined) runBtn.disabled = !run;
    if (pause !== undefined) pauseBtn.disabled = !pause;
    if (reset !== undefined) resetBtn.disabled = !reset;
}



/* ============================================================
   BALL DROP ANIMATION — SECTION V
   ============================================================ */

let ballDropTimer = null;
let ballDropPaused = false;

const BALL_DROP_INTERVAL_MS = 12; // lower = faster

function clearBuckets() {
    document.querySelectorAll(".bucket-dots").forEach(el => {
        el.innerHTML = "";
    });
}

function spawnBall(result) {
    const dot = document.createElement("div");
    dot.className = "ball-dot falling";

    activeFallingBalls++;

    dot.addEventListener("animationend", () => {
        activeFallingBalls--;

        // If this was the last ball, finalize lifecycle
        if (ballDropInProgress &&
            ballDropIndex >= simulationResults.length &&
            activeFallingBalls === 0) {

            finalizeBallDrop();
        }
    });
    
    const target =
        result.winner === "A"
            ? document.querySelector("#bucket-team-a .bucket-dots")
            : document.querySelector("#bucket-team-b .bucket-dots");

    const BALL_SIZE = 9; // must match CSS (visual diameter)
    const STACK_DENSITY = 0.01;   // <— tweakable (smaller -> more overlap)

    const pileHeight =
        Math.floor(target.children.length * BALL_SIZE * STACK_DENSITY);

    // Horizontal spread (bucket-relative)
    const bucketWidth = target.clientWidth;
    const maxOffset = bucketWidth * 0.43;  //.35  higher pushes balls closer to the wall
    const offset = Math.floor(Math.random() * maxOffset * 2 - maxOffset);

    dot.style.left = "50%";
    dot.style.bottom = `${pileHeight}px`;
    dot.style.setProperty("--x-offset", `${offset}px`);

    target.appendChild(dot);

    // Visual-only cap to prevent DOM overload
    //if (target.children.length > 250) {
        //target.removeChild(target.firstChild);
    //}
}





function stepBallDrop() {    
    if (!ballDropInProgress) return;
    
    if (ballDropIndex >= simulationResults.length) {        
        return; // Let animationend handlers finalize
    }

    spawnBall(simulationResults[ballDropIndex]);
    ballDropIndex++;

    const speedMultiplier = 
        simulationResults.length > 5000 && ballDropIndex > 5000
            ? 0.5 // double speed
            : 1.0; // normal speed
    
    setTimeout(stepBallDrop, BALL_DROP_INTERVAL_MS * speedMultiplier);
    
}

function startBallDrop() {
    if (!simulationResults || simulationResults.length === 0) return;
        
    stopBallDrop();
    clearBuckets();

    ballDropInProgress = true;
    activeFallingBalls = 0;
    
    ballDropIndex = 0;
    ballDropPaused = false;
    
    ballDropTimer = setInterval(stepBallDrop, BALL_DROP_INTERVAL_MS);

    stepBallDrop();
}

function stopBallDrop() {
    if (ballDropTimer) {
        clearInterval(ballDropTimer);
        ballDropTimer = null;
    }
}

function pauseBallDrop() {
    ballDropPaused = true;
}

function resumeBallDrop() {
    ballDropPaused = false;
}

function finalizeBallDrop() {
    ballDropInProgress = false;

    // UI state cleanup
    document.getElementById("run-simulation-btn").disabled = true;
    document.getElementById("pause-simulation-btn").disabled = true;
    document.getElementById("reset-simulation-btn").disabled = false;

    document.getElementById("visualization-header").textContent =
        "Simulation Complete";

    renderDistributionChart(simulationResults);
}

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    mountControlPanel();
    initializeTabs();
    loadTeamStats();

    // Initial UI state
    setButtonState({
        run: true,
        pause: false,
        reset: false
    });
});

document.getElementById("pause-simulation-btn")
    .addEventListener("click", () => {
        pauseBallDrop();
    });

/*document.getElementById("resume-simulation-btn")
    .addEventListener("click", () => {
        resumeBallDrop();
    });*/

document.getElementById("run-simulation-btn")
    .addEventListener("click", () => {
        setButtonState({
            run: false,
            pause: false,
            reset: false
        });

        runSimulation();
    });

document.getElementById("reset-simulation-btn")
    .addEventListener("click", resetSimulation);


/* ============================================================
   BALL DROP EVENT WIRING
   ============================================================ */

document.addEventListener("simulationComplete", () => {
    const { teamA, teamB } = computeWinPercentages(simulationResults);

    const labelA = document.querySelector("#bucket-team-a .bucket-label");
    const labelB = document.querySelector("#bucket-team-b .bucket-label");

    if (labelA) {
        labelA.textContent = `Team A — ${(teamA * 100).toFixed(1)}%`;
    }

    if (labelB) {
        labelB.textContent = `Team B — ${(teamB * 100).toFixed(1)}%`;
    }
    
    setButtonState({
        run: false,
        pause: true,
        reset: true
    });

    startBallDrop();
});


document.addEventListener("simulationReset", () => {
    stopBallDrop();
    clearBuckets();

    setButtonState({
        run: true,
        pause: false,
        reset: false
    });
});

