/* ============================================================
   NFL Monte Carlo Matchup Simulator
   app.js — System Orchestrator (Source of Truth)

   References:
   - Master Spec Sections X, V, W, AF, AE
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
   RNG — SEEDED, DETERMINISTIC
   ============================================================ */

function createSeededRNG(seed) {
    let state = seed >>> 0;
    return function () {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0xFFFFFFFF;
    };
}


/* ============================================================
   CONTROL PANEL — DOM CREATION
   Section W.3
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
   INPUT SNAPSHOT (AUTHORITATIVE)
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
   SIMULATION CORE (UNCHANGED)
   ============================================================ */

function normalizeRank(rank) {
    return (16.5 - rank) / 15.5;
}

function runSingleSimulation(inputSnapshot, runIndex) {
    const A = inputSnapshot.teamA;
    const B = inputSnapshot.teamB;

    const A_base = {
        rushOff: normalizeRank(A.ranks.rushOffense),
        passOff: normalizeRank(A.ranks.passOffense),
        rushDef: normalizeRank(A.ranks.rushDefense),
        passDef: normalizeRank(A.ranks.passDefense)
    };

    const B_base = {
        rushOff: normalizeRank(B.ranks.rushOffense),
        passOff: normalizeRank(B.ranks.passOffense),
        rushDef: normalizeRank(B.ranks.rushDefense),
        passDef: normalizeRank(B.ranks.passDefense)
    };

    const A_offense = (A_base.rushOff - B_base.rushDef) +
                      (A_base.passOff - B_base.passDef);

    const B_offense = (B_base.rushOff - A_base.rushDef) +
                      (B_base.passOff - A_base.passDef);

    const baseVar = inputSnapshot.global.baselineVariance;
    const varMin = inputSnapshot.global.varianceBounds.min;
    const varMax = inputSnapshot.global.varianceBounds.max;

    const A_noise = (rng() * 2 - 1) * Math.min(Math.max(baseVar, varMin), varMax);
    const B_noise = (rng() * 2 - 1) * Math.min(Math.max(baseVar, varMin), varMax);

    const A_realized = A_offense + A_noise;
    const B_realized = B_offense + B_noise;

    let winner = A_realized >= B_realized ? "A" : "B";
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
    let A = 0, B = 0, diffs = [];

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

function initializeTabs() {
    const buttons = document.querySelectorAll(".tab-button");
    const tabs = document.querySelectorAll(".tab-content");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-tab");

            // Deactivate all tabs and buttons
            buttons.forEach(b => b.classList.remove("active"));
            tabs.forEach(t => t.classList.remove("active"));

            // Activate selected tab
            btn.classList.add("active");
            const target = document.getElementById(targetId);
            if (target) {
                target.classList.add("active");
            }
        });
    });
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
        if (!res.ok) throw new Error("HTTP error");

        const json = await res.json();

        // Section AF: informational only
        teamStatsData = json.seasons[0];
        renderTeamStatsTable(teamStatsData.teams);
    } catch (err) {
        const errorEl = document.getElementById("team-stats-error");
        if (errorEl) {
            errorEl.hidden = false;
        }
    }
}

function renderTeamStatsTable(teams) {
    const container = document.getElementById("team-stats-container");
    container.innerHTML = "";

    if (!teams || !teams.length) return;

    const table = document.createElement("table");
    table.style.width = "100%";
    table.border = "1";

    const columns = Object.keys(teams[0]);

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    columns.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col;
        th.style.cursor = "pointer";
        th.addEventListener("click", () => sortTeamStats(col));
        headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    teams.forEach(team => {
        const tr = document.createElement("tr");
        columns.forEach(col => {
            const td = document.createElement("td");
            td.textContent = team[col];
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

function sortTeamStats(key) {
    if (!teamStatsData) return;

    teamStatsSortAsc =
        teamStatsSortKey === key ? !teamStatsSortAsc : true;

    teamStatsSortKey = key;

    const sorted = [...teamStatsData.teams].sort((a, b) => {
        if (a[key] === b[key]) return 0;
        return (a[key] > b[key] ? 1 : -1) * (teamStatsSortAsc ? 1 : -1);
    });

    renderTeamStatsTable(sorted);
}




/* ============================================================
   INIT
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    mountControlPanel();
    initializeTabs();
    loadTeamStats();
});

document.getElementById("run-simulation-btn")
    .addEventListener("click", runSimulation);

document.getElementById("reset-simulation-btn")
    .addEventListener("click", resetSimulation);
