/* logic.js */

let globalData = null; // Stores the loaded JSON
let currentSeason = "2024";

// --- 1. Initialization & Data Loading ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('teams.json');
        globalData = await response.json();
        
        initDropdowns();
        setupEventListeners();
        console.log("System Ready: Data Loaded");
    } catch (error) {
        console.error("Error loading teams.json:", error);
    }
});

function initDropdowns() {
    const teamASelect = document.getElementById('team-a-select');
    const teamBSelect = document.getElementById('team-b-select');
    
    // Clear existing
    teamASelect.innerHTML = '<option value="">Select Team...</option>';
    teamBSelect.innerHTML = '<option value="">Select Team...</option>';

    globalData.teams.forEach(team => {
        const optionA = document.createElement('option');
        optionA.value = team.id;
        optionA.textContent = team.name;
        
        const optionB = optionA.cloneNode(true);
        
        teamASelect.appendChild(optionA);
        teamBSelect.appendChild(optionB);
    });
}

function setupEventListeners() {
    document.getElementById('season-select').addEventListener('change', (e) => {
        currentSeason = e.target.value;
        updateMatchupTable(); // Refresh stats if season changes
    });
    
    document.getElementById('team-a-select').addEventListener('change', updateMatchupTable);
    document.getElementById('team-b-select').addEventListener('change', updateMatchupTable);
    
    document.getElementById('run-sim-btn').addEventListener('click', runSimulationController);
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
}


// --- 2. The Stat Table Logic (Dynamic Ranking) ---
function updateMatchupTable() {
    const idA = document.getElementById('team-a-select').value;
    const idB = document.getElementById('team-b-select').value;

    if (!idA || !idB) return;

    const teamA = globalData.teams.find(t => t.id === idA);
    const teamB = globalData.teams.find(t => t.id === idB);
    
    const statsA = teamA.seasons[currentSeason];
    const statsB = teamB.seasons[currentSeason];

    // Helper to calculate rank dynamically within the loaded dataset
    const getRank = (metric, value, isDescending = true) => {
        const allValues = globalData.teams.map(t => t.seasons[currentSeason][metric]);
        allValues.sort((a, b) => isDescending ? b - a : a - b); // Descending for Offense, Ascending for Defense
        return allValues.indexOf(value) + 1; // 1-based rank
    };

    // Update Headers with Colors
    document.getElementById('table-header-a').textContent = teamA.id;
    document.getElementById('table-header-a').style.borderBottom = `4px solid ${teamA.primaryColor}`;
    document.getElementById('table-header-b').textContent = teamB.id;
    document.getElementById('table-header-b').style.borderBottom = `4px solid ${teamB.primaryColor}`;

    const tbody = document.getElementById('stats-table-body');
    tbody.innerHTML = ''; // Clear current rows

    // Define rows configuration
    const metrics = [
        { label: "Points Scored / Gm", key: "off_pts_gm", highIsGood: true },
        { label: "Pass Yds / Gm", key: "off_pass_yd_gm", highIsGood: true },
        { label: "Rush Yds / Gm", key: "off_rush_yd_gm", highIsGood: true },
        { label: "Points Allowed / Gm", key: "def_pts_gm", highIsGood: false },
        { label: "Def Pass Yds / Gm", key: "def_pass_yd_gm", highIsGood: false },
        { label: "Def Rush Yds / Gm", key: "def_rush_yd_gm", highIsGood: false }
    ];

    metrics.forEach(m => {
        const valA = statsA[m.key];
        const valB = statsB[m.key];
        const rankA = getRank(m.key, valA, m.highIsGood);
        const rankB = getRank(m.key, valB, m.highIsGood);

        const row = `
            <tr>
                <td>${m.label}</td>
                <td>${valA} <small>(${rankToOrdinal(rankA)})</small></td>
                <td>${valB} <small>(${rankToOrdinal(rankB)})</small></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function rankToOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}


// --- 3. The Monte Carlo Engine (Z-Score Math) ---
function runSimulationController() {
    const idA = document.getElementById('team-a-select').value;
    const idB = document.getElementById('team-b-select').value;
    
    if (!idA || !idB) {
        alert("Please select two teams first.");
        return;
    }

    const teamA = globalData.teams.find(t => t.id === idA);
    const teamB = globalData.teams.find(t => t.id === idB);
    
    // 1. Gather Inputs
    const homeField = parseFloat(document.getElementById('home-field').value); // 0 to 4
    const weather = parseInt(document.getElementById('weather-select').value); // 0, -1, -2
    const momA = parseInt(document.getElementById('momentum-a').value);
    const momB = parseInt(document.getElementById('momentum-b').value);

    // 2. Calculate Base Spread using Z-Scores
    // We compare Team A Offense vs Team B Defense (and vice versa)
    const expectedScoreA = teamA.seasons[currentSeason].off_pts_gm;
    const expectedScoreB = teamB.seasons[currentSeason].off_pts_gm;
    
    // Simple Model: Base Spread = (AvgDiff) + HomeField + Momentum
    let baseSpread = (expectedScoreA - expectedScoreB) + homeField + (momA - momB);
    
    // Weather Impact: Reduces total scoring, might compress spread? 
    // For now, we'll say weather hurts the Passing team more.
    if (weather < 0) {
        // Example: If Team A passes more, they are hurt more.
        // Simplified: reduces score slightly
    }

    // 3. Monte Carlo Loop
    const iterations = 10000;
    let teamAWins = 0;
    let margins = []; // Collect results for Histogram

    // Standard Deviation of NFL games is approx 13.5
    const stdDev = 13.5; 

    for (let i = 0; i < iterations; i++) {
        // Random Noise
        const noise = gaussianRandom(0, stdDev);
        
        // Final Score Differential for this single run
        // If > 0, Team A wins. If < 0, Team B wins.
        const margin = baseSpread + noise;
        
        margins.push(margin);
        if (margin > 0) teamAWins++;
    }

    // 4. Process Results
    const winPctA = (teamAWins / iterations) * 100;
    const winPctB = 100 - winPctA;
    const avgMargin = margins.reduce((a, b) => a + b, 0) / iterations;

    // 5. Update UI
    document.getElementById('win-prob-display').textContent = `Win Prob: ${teamA.id} ${winPctA.toFixed(1)}%`;
    document.getElementById('win-pct').textContent = `${winPctA.toFixed(1)}%`;
    document.getElementById('avg-margin').textContent = `${Math.abs(avgMargin.toFixed(1))} pts`;

    console.log(`Sim Complete. Spread: ${baseSpread.toFixed(2)}, Win%: ${winPctA}%`);
    
    // FUTURE: Trigger Matter.js and Chart.js here with 'margins' array
    // window.runVisuals(margins, teamA, teamB);
}

// Standard Box-Muller Transform for Normal Distribution
function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random(); 
    const v = 1 - Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    return z * stdev + mean;
}

function resetSimulation() {
    document.getElementById('win-prob-display').textContent = "Win Prob: --%";
    document.getElementById('win-pct').textContent = "--";
    document.getElementById('avg-margin').textContent = "--";
    // Future: Clear Canvas
}
