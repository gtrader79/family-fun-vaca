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
}


/* ============================================================
   TEAM STATS — SECTION AF (READ-ONLY)
   ============================================================ */

let teamStatsData = null;
let teamStatsSortKey = null;
let teamStatsSortAsc = true;

async function loadTeamStats() {
    try {
        const res = await fetch("teams.json");
        if (!res.ok) throw new Error("HTTP");

        const json = await res.json();
        teamStatsData = json.seasons[0];
        renderTeamStatsTable(teamStatsData.teams);
    } catch {
        document.getElementById("team-stats-error").hidden = false;
    }
}

function renderTeamStatsTable(teams) {
    const container = document.getElementById("team-stats-container");
    container.innerHTML = "";

    const table = document.createElement("table");
    table.style.width = "100%";
    table.border = "1";

    const columns = Object.keys(teams[0]);

    const thead = document.createElement("thead");
    const tr = document.createElement("tr");

    columns.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col;
        th.style.cursor = "pointer";
        th.onclick = () => sortTeamStats(col);
        tr.appendChild(th);
    });

    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    teams.forEach(t => {
        const row = document.createElement("tr");
        columns.forEach(c => {
            const td = document.createElement("td");
            td.textContent = t[c];
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

function sortTeamStats(key) {
    teamStatsSortAsc =
        teamStatsSortKey === key ? !teamStatsSortAsc : true;

    teamStatsSortKey = key;

    const sorted = [...teamStatsData.teams].sort((a, b) =>
        (a[key] > b[key] ? 1 : -1) * (teamStatsSortAsc ? 1 : -1)
    );

    renderTeamStatsTable(sorted);
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

let ballDropIndex = 0;
let ballDropTimer = null;
let ballDropPaused = false;

const BALL_DROP_INTERVAL_MS = 15;

function clearBuckets() {
    document.querySelectorAll(".bucket-dots").forEach(el => {
        el.innerHTML = "";
    });
}

function spawnBall(result) {
    const dot = document.createElement("div");
    dot.className = "ball-dot";

    const target =
        result.winner === "A"
            ? document.querySelector("#bucket-team-a .bucket-dots")
            : document.querySelector("#bucket-team-b .bucket-dots");

    target.appendChild(dot);
}

function stepBallDrop() {
    if (ballDropPaused) return;

    if (ballDropIndex >= simulationResults.length) {
        stopBallDrop();
        return;
    }

    spawnBall(simulationResults[ballDropIndex]);
    ballDropIndex++;
}

function startBallDrop() {
    stopBallDrop();
    clearBuckets();

    ballDropIndex = 0;
    ballDropPaused = false;

    ballDropTimer = setInterval(stepBallDrop, BALL_DROP_INTERVAL_MS);
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

