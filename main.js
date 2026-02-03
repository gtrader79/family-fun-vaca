/* main.js 
    Controller:  Everything starts here
*/

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. Initialization & DOM Elements ---
    console.log("Initializing NFL Simulation Controller...");
    
    // FIX: Define these elements immediately so they are available to all functions
    const selA = document.getElementById(DOM_IDS.teamA);
    const selB = document.getElementById(DOM_IDS.teamB);
    const selSeason = document.getElementById(DOM_IDS.seasonSelect);
    
    const runBtns = [
        document.getElementById(DOM_IDS.runBtn), 
        document.getElementById(DOM_IDS.mobileRunBtn)
    ];

    // Initialize Physics (Visuals.js) immediately so the canvas is ready
    if (typeof initPhysics === 'function') {
        initPhysics();
    }

    // --- 2. Data Fetching ---
    try {
        const response = await fetch('teams.json'); 
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const jsonData = await response.json();
        
        // Store in Global State
        App.data.allSeasons = jsonData;
        
        // Get the most recent year.        
        App.data.teams = jsonData.seasons[jsonData.seasons.length-1].teams; 

        // Populate Dropdowns (Now safe because selA/selB are defined)
        populateTeamSelects();
        console.log("Teams loaded:", App.data.teams.length);

    } catch (e) {
        console.error("CRITICAL: Failed to load teams.json", e);
        alert("Error loading team data. Please ensure teams.json is present.");
    }

    // --- 3. Pre-Calculation ---
    // Calculate the Normalization Factor once on load
    if (App.data.teams) {
         App.simulation.normalizationFactor = Utils.calculateNormalizationFactor(SIM_CONFIG.weights, 10000);
    }

    // --- 4. Event Listeners ---

    // A. Team Selectors Logic
    function handleTeamChange() {
        // 1. Get IDs
        const idA = selA ? selA.value : null;
        const idB = selB ? selB.value : null;

        // 2. Find Objects
        if(idA) App.data.teamA = App.data.teams.find(t => t.teamId === idA);
        if(idB) App.data.teamB = App.data.teams.find(t => t.teamId === idB);

        // 3. Update UI
        Renderer.updateMatchupTable();
    }

    if(selA) selA.addEventListener('change', handleTeamChange);
    if(selB) selB.addEventListener('change', handleTeamChange);


    // B. Run Simulation Buttons (Desktop & Mobile)
    runBtns.forEach(btn => {
        if(btn) {
            btn.addEventListener('click', () => {
                // 1. Validation
                if (!App.data.teamA || !App.data.teamB) {
                    alert("Please select both Team A and Team B.");
                    return;
                }

                // 2. Gather Inputs (Reads DOM)
                const factors = InputManager.getFactors();
                App.inputs.factors = factors; // Persist for debugging

                // 3. Run Engine (Pure Math)
                Engine.run(App.data.teamA, App.data.teamB, factors);

                // 4. Render Results (Updates DOM)
                Renderer.renderResults();

                // 5. Trigger Visuals (Physics)
                if (typeof dropBalls === 'function') {
                    dropBalls();
                }

                // 6. Mobile UX: Close Sidebar if open
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            });
        }
    });

    // --- Helpers ---
    function populateSeasonSelects() {        
        const seasons = App.data.allSeasons.seasons;
        //Sort Descendingly
        seasons.sort((a, b) => b.season - a.season);

        let seasonOptions = '<option value="">-- Select Season --</option>';
        seasons.forEach(s => {
            seasonOptions += `<option value="${s.season}">${s.season} Season</option>`;
        });

        if(selSeason) selSeason.innerHTML = seasonOptions;

    }
    function populateTeamSelects() {
        const teams = App.data.teams;
        // Sort alphabetically by Full Name
        teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
        
        let options = '<option value="">-- Select Team --</option>';
        teams.forEach(t => {
            options += `<option value="${t.teamId}">${t.teamName}</option>`;
        });

        if(selA) selA.innerHTML = options;
        if(selB) selB.innerHTML = options;
    }

    // Tab Logic (Legacy UI support)
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            const target = document.getElementById(targetId);
            if(target) target.classList.add('active');
        });
    });
});
