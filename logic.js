/* logic.js */

let globalData = null; // Stores the loaded JSON
let currentSeason = "2025";


/********************************************************************************************
    
    1. Initialize & Data Loading
    
********************************************************************************************/
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
    /******************
            Season
    *******************/
        const seasonSelect = document.getElementById('season-select');
        //Clear existing
        seasonSelect.innerHTML = '<option value="">Select Season...</option>';
        
        const seasonArray = globalData.seasons
            .map(s => s.season)         // 1. Get the array of teams you want to sort
            .sort((a, b) => b - a)      // 2. Sort the array numerically
            .forEach(year => {
                const optionSeason = document.createElement('option');
                optionSeason.value = year;
                optionSeason.textContent = `${year} Season`;

                seasonSelect.appendChild(optionSeason);
                });

    /******************
            Team Name
    *******************/
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


/********************************************************************************************
    
    2. The Stat Table Population
    
********************************************************************************************/
function updateMatchupTable() {
    const idYr = document.getElementById('season-select').value;
    const idA = document.getElementById('team-a-select').value;
    const idB = document.getElementById('team-b-select').value;

    if (!idYr || !idA || !idB) return;

    // 1. Find the correct season data from the array
    // We use == to match string "2021" with number 2021 if needed
    const seasonData = globalData.seasons.find(s => s.season == idYr);

    if (!seasonData) {
        console.error("Season not found:", idYr);
        return;
    }

    // 2. Find team within that specific season
    const teamA = seasonData.teams.find(t => t.teamId === idA);
    const teamB = seasonData.teams.find(t => t.teamId === idB);
    
    // Note: In your new JSON, the stats are directly on the team object, 
    // so we don't need a separate 'statsA' object anymore.

    // Update Headers with Colors
    document.getElementById('table-header-metrics').textContent = `${idYr} Season Metrics`
    document.getElementById('table-header-a').textContent = teamA.teamId;
    document.getElementById('table-header-a').style.borderBottom = `4px solid ${teamA.primaryColor}`;
    document.getElementById('table-header-b').textContent = teamB.teamId;
    document.getElementById('table-header-b').style.borderBottom = `4px solid ${teamB.primaryColor}`;

    const tbody = document.getElementById('stats-table-body');
    tbody.innerHTML = ''; // Clear current rows

    //First Append Win / Loss
    const row = `<tr><td>Record (Win - Loss)</td><td>${teamA.wins} - ${teamA.losses}</td><td>${teamB.wins} - ${teamB.losses}</td></tr>`;
    
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
    
    metrics.forEach((m, i) => {
        //Create a place holder for Offense or Defense sub headers
        if (i === 0) {
            const oRow = `<tr><td>Offense</td><td></td><td></td></tr>`;
            tbody.innerHTML += oRow;
        }
        if (i === 4) {
            const oRow = `<tr><td>Defense</td><td></td><td></td></tr>`;
            tbody.innerHTML += oRow;
        }
        
        // Access values directly from the team object
        const valA = teamA[m.key];
        const valB = teamB[m.key];
        
        // Access ranks directly from the team object
        const rankA = teamA[m.rankKey];
        const rankB = teamB[m.rankKey];

        const row = `
            <tr>
                <td style="padding-left: 45px;">${m.label}</td>
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



/********************************************************************************************
    
    3. Monte Carlo Simulation
    
********************************************************************************************/
function runSimulationController() {
    /*******************************
      -- i. Constant Values --
    *******************************/
      /*** Noise Settings -  linked to UI and selected by User  ***/
        const noiseSettings = [
            {id:1, label:'Very Stable', threshold: 0.15},
            {id:2, label:'Realistic Game Scenario', threshold:0.25},
            {id:3, label:'High Volitility', threshold: 0.35},
            {id:4, label:'Chaos Mode', threshold: 0.50}
        ];
      /*** Home Field Advantage - 2 points given to home team.  Average NFL game spread is 14 points. 2/14 ~.143  ***/
        const HFA = 0.143;  
      /*** Weighting for Passing and Rushing   ***/
        const WEIGHTS = { pass: 1.0, rush: 0.85 };
      /*** Number of MonteCarlo Runs   ***/
        const numberOfRuns = [
            {id:1, label:'500 Runs', value: 500},
            {id:2, label:'1,000 Runs', value: 1000},
            {id:3, label:'5,000 Runs', value: 5000},
            {id:4, label:'10,000 Runs', value: 10000},
        ];
        
    
    
    /*******************************
      -- ii. Helper Functions --
    *******************************/
    /** Calculate Mean and StdDev in a single pass to improve speed    ***/
        const calculateStats = (numbers) => {
            const n = numbers.length;
            if (n === 0) return { average: 0, stdDev: 0 };
    
            const sum = numbers.reduce((acc, val) => acc + val, 0);
            const avg = sum / n;
    
            const variance = numbers.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / n;
    
            return { average: avg, stdDev: Math.sqrt(variance) };
        };
    
    /*** Reusable Z-Score helper to handle offensive/defensive inversion  ***/
        const getZScore = (val, stats, invert = false) => {
          const z = (val - stats.average) / stats.stdDev;
          return invert ? -z : z;
        };
    
    /*** Sigmoid function for probability mapping   ***/
        const sigmoid = (x) => 1 / (1 + Math.exp(-x));
    
    /*** Noise Function for Monte Carlo simulations   ***/
        const generateNoise = (x) => Math.random() * (2 * x) + (-x);
    
    
    /*******************************
      -- iii. Data Source Management --
            --  Data is grouped into objects to prevent 'variable soup'
    *******************************/
        const idYr = document.getElementById('season-select').value;
        const idA = document.getElementById('team-a-select').value;
        const idB = document.getElementById('team-b-select').value;
    
        if (!idYr || !idA || !idB) return;
    
        // 1. Find the correct season data from the array
        const seasonData = globalData.seasons.find(s => s.season == idYr);
    
        if (!seasonData) {
            console.error("Season not found:", idYr);
            return;
        }
    
        //2.  Get stat per team for entire season
        
        const seasonRawData = {
          offPass: seasonData.teams.map(t=>t.off_pass_yards_per_game),
          offRush: seasonData.teams.map(t=>t.off_rush_yards_per_game),
          defPass: seasonData.teams.map(t=>t.def_pass_yards_allowed_per_game),
          defRush: seasonData.teams.map(t=>t.def_rush_yards_allowed_per_game)
        };
        
        // 3. Map raw data to a single "metrics" object
        const metrics = Object.fromEntries(
          Object.entries(seasonRawData).map(([key, data]) => [key, calculateStats(data)])
        );
    
    
        // 4. Find team within that specific season -> Get Team Metrics
        const teamA = seasonData.teams.find(t => t.teamId === idA);
        const teamB = seasonData.teams.find(t => t.teamId === idB);
    
        const teamAMetrics = { name: "Team A"
                              , passOff: teamA.off_pass_yards_per_game
                              , rushOff: teamA.off_rush_yards_per_game
                              , passDef: teamA.def_pass_yards_allowed_per_game
                              , rushDef: teamA.def_rush_yards_allowed_per_game };
        const teamBMetrics = { name: "Team B"
                              , passOff: teamB.off_pass_yards_per_game
                              , rushOff: teamB.off_rush_yards_per_game
                              , passDef: teamB.def_pass_yards_allowed_per_game
                              , rushDef: teamB.def_rush_yards_allowed_per_game };
    
    /*******************************
      -- iv. Logic Engine --
            --  Centralized strength calculation for consistency
    *******************************/
        function calculateTotalStrength(team, opponent, n, hfa = 0) {  
          // 1. Calculate matchup advantages using Z-Scores:  (Offense + Noise) - (Inverted Defense + Noise)
          const passAdv = (getZScore(team.passOff, metrics.offPass) + generateNoise(n)) - (getZScore(opponent.passDef, metrics.defPass, true) + generateNoise(n));
          const rushAdv = (getZScore(team.rushOff, metrics.offRush) + generateNoise(n)) - (getZScore(opponent.rushDef, metrics.defRush, true) + generateNoise(n));
        
          return (passAdv * WEIGHTS.pass) + (rushAdv * WEIGHTS.rush) + hfa;
        }
        
        // 2. Execute Calculations that stay constant with each simulated run
        const noise_selection = noiseSettings.find(item => item.id == 1);
        const noise_threshold = noise_selection ? noise_selection.threshold : 0;


    /*******************************
      -- v. Simulated Runs --            
    *******************************/
        const numIterations = 10000;
        const simulatedRuns = [];
        for (let i = 0; i < numIterations; i++) {
            // 1. Calculate variables for this specific simulation run
            const strengthA = calculateTotalStrength(teamAMetrics, teamBMetrics, noise_threshold, HFA);
            const strengthB = calculateTotalStrength(teamBMetrics, teamAMetrics, noise_threshold);
            const delta = strengthA - strengthB;
            const probabilityA = sigmoid(delta);
            const probabilityB = 1 - probabilityA;
        
            // 2. Store the results as an object in the array
            simulatedRuns.push({
                strengthA,
                strengthB,
                delta,
                probabilityA,
                probabilityB
            });
        }
};






function resetSimulation() {
    document.getElementById('win-prob-display').textContent = "Win Prob: --%";
    document.getElementById('win-pct').textContent = "--";
    document.getElementById('avg-margin').textContent = "--";
    // Future: Clear Canvas
}




