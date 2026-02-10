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
        populateSeasonSelects();
        console.log("Seasons loaded:", App.data.allSeasons.length);
        populateTeamSelects();
        console.log("Teams loaded:", App.data.teams.length);

    } catch (e) {
        console.error("CRITICAL: Failed to load teams.json", e);
        alert("Error loading team data. Please ensure teams.json is present.");
    }

    // --- 3. Pre-Calculation ---
    
    if (App.data.teams) {
        // Calculate the Normalization Factor once on load 
        App.simulation.normalizationFactor = Utils.calculateNormalizationFactor(SIM_CONFIG.weights, 10000);
        
        // Calculate the league Metrics for the Season once on load 
        const league = Renderer.metrics.reduce((acc, m) => {
          // We map over the teams to get the array of values for the specific key
          const values = App.data.teams.map(t => t[m.key]);
          
          // Assign the stats to the object using the statNm as the property name
          acc[m.statNm] = Utils.getStats(values);
          
          return acc;
        }, {});
        
        if (league) {App.data.leagueMetrics = league;}
        console.log("League metrics calculated and stored");
        
    }

    // --- 4. Event Listeners ---

        // A. Team Selectors Logic
        function handleTeamChange(event) {
            // 1. Get IDs
            const idA = selA ? selA.value : null;
            const idB = selB ? selB.value : null;
    
            // 2. Find Objects
            if(idA) App.data.teamA = App.data.teams.find(t => t.teamId === idA);
            if(idB) App.data.teamB = App.data.teams.find(t => t.teamId === idB);
    
            // 3. Update Matchup Config
            const selectedText = event.target.options[event.target.selectedIndex].text;
            // Determine if it's 'teamA' or 'teamB' based on the ID
            const teamKey = event.target.id.includes('-a-') ? 'teamA' : 'teamB';
            
            populateSituationalInputs(teamKey, selectedText);
            
            // 4. Update UI
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
                    const factors = InputManager.getFactors();  //inputs.js
                    App.inputs.factors = factors; // Persist for debugging
    
                    // 3. Run Engine (Pure Math)
                    Engine.run(App.data.teamA, App.data.teamB, factors);
    
                    // 4. Render Results (Updates DOM)
                    //Renderer.renderResults();
    
                    // 5. Trigger Visuals (Physics)
                    if (typeof dropBalls === 'function') {
                      //  dropBalls();
                    }
    
                    // 6. Mobile UX: Close Sidebar if open
                    const sidebar = document.getElementById('sidebar');
                    if (sidebar && sidebar.classList.contains('open')) {
                        sidebar.classList.remove('open');
                    }
                });
            }
        });
    
        // C. Accordion Logic for Set Up
        const accHeaders = document.querySelectorAll('.accordion-header');
    
        accHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                
                // Optional: Close others? For now, we allow multiple open
                item.classList.toggle('active');
            });
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
    function populateSituationalInputs(key, teamName) {
        // Standardize IDs so they only differ by the suffix (teamA vs teamB)
        const suffix = key; 
    
        const updates = [
            { id: `hfa-${suffix}`, text: teamName },
            { id: `rest-gap-${suffix}`, text: `Rest Gap for ${teamName}` },
            { id: `momentum-${suffix}`, text: teamName },
            { id: `travel-${suffix}`, text: `${teamName} Traveled` },
            { id: `accordion-header-${key === 'teamA' ? 'team-a' : 'team-b'}`, text: `3. Injury Report: ${teamName}` }
        ];
    
        updates.forEach(item => updateElementText(item.id, item.text));
    }
    
    function updateElementText(elId, content) {
        const el = document.getElementById(elId);
        if (el) {
            // Use textContent instead of innerHTML for better performance and security
            el.textContent = content;
        }
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
