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

    // 1. Get the array of teams you want to sort
        const teamsArray = globalData.seasons[1].teams;
    // 2. Sort the array in place based on the 'teamName' property
        teamsArray.sort((a, b) => {
              // Use localeCompare for robust alphabetical string comparison
              return a.teamName.localeCompare(b.teamName);
            });
    
    teamsArray.forEach(team => {
        const optionA = document.createElement('option');
        optionA.value = team.teamId;
        optionA.textContent = team.teamName;
        
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

    // 1. Find the correct season data from the array
    // We use == to match string "2021" with number 2021 if needed
    const seasonData = globalData.seasons.find(s => s.season == currentSeason);

    if (!seasonData) {
        console.error("Season not found:", currentSeason);
        return;
    }

    // 2. Find teams within that specific season
    const teamA = seasonData.teams.find(t => t.teamId === idA);
    const teamB = seasonData.teams.find(t => t.teamId === idB);
    
    // Note: In your new JSON, the stats are directly on the team object, 
    // so we don't need a separate 'statsA' object anymore.

    // Update Headers with Colors
    document.getElementById('table-header-a').textContent = teamA.teamId;
    document.getElementById('table-header-a').style.borderBottom = `4px solid ${teamA.primaryColor}`;
    document.getElementById('table-header-b').textContent = teamB.teamId;
    document.getElementById('table-header-b').style.borderBottom = `4px solid ${teamB.primaryColor}`;

    const tbody = document.getElementById('stats-table-body');
    tbody.innerHTML = ''; // Clear current rows

    // Define rows configuration using your specific JSON keys
    // We explicitly map the 'value' key and the 'rank' key
    const metrics = [
        { label: "Points Scored / Gm", key: "off_points_scored_per_game", rankKey: "off_points_scored_per_game_rank" },
        { label: "Pass Yds / Gm", key: "off_pass_yards_per_game", rankKey: "off_pass_yards_per_game_rank" },
        { label: "Rush Yds / Gm", key: "off_rush_yards_per_game", rankKey: "off_rush_yards_per_game_rank" },
        { label: "Total Yds / Gm", key: "off_total_yards_per_game", rankKey: "off_total_yards_per_game_rank" },
        { label: "Points Allowed / Gm", key: "def_points_allowed_per_game", rankKey: "def_points_allowed_per_game_rank" },
        { label: "Def Pass Yds / Gm", key: "def_pass_yards_allowed_per_game", rankKey: "def_pass_yards_allowed_per_game_rank" },
        { label: "Def Rush Yds / Gm", key: "def_rush_yards_allowed_per_game", rankKey: "def_rush_yards_allowed_per_game_rank" },
        { label: "Def Total Yds / Gm", key: "def_total_yards_allowed_per_game", rankKey: "def_total_yards_allowed_per_game_rank" }
    ];

    metrics.forEach(m => {
        // Access values directly from the team object
        const valA = teamA[m.key];
        const valB = teamB[m.key];
        
        // Access ranks directly from the team object
        const rankA = teamA[m.rankKey];
        const rankB = teamB[m.rankKey];

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

