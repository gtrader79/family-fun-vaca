/* main.js 
    Controller:  Everything starts here
*/

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Initialize System
    console.log("Initializing NFL Simulation...");
    
    // 2. Fetch Data
    try {
        const response = await fetch('teams.json'); // Ensure this path is correct
        const jsonData = await response.json();
        
        // Populate State
        App.data.allSeasons = jsonData;
        // Default to most recent year
        App.data.teams = jsonData.seasons[jsonData.seasons.length-1].teams; 

        populateTeamSelects();
    } catch (e) {
        console.error("Failed to load teams.json", e);
        alert("Error loading team data. Check console.");
    }

    // 3. Pre-Calculate Math (Optimization)
    // Run this once so we don't do it on every click
    App.simulation.normalizationFactor = Utils.calculateNormalizationFactor(SIM_CONFIG.weights, 10000);

    // 4. Initialize Visuals
    if (typeof initPhysics === 'function') {
        initPhysics();
    }

    // --- Event Listeners ---

    // A. Team Selection Changes
    const selA = document.getElementById(DOM_IDS.teamA);
    const selB = document.getElementById(DOM_IDS.teamB);

    function handleTeamChange() {
        const idA = selA.value;
        const idB = selB.value;

        // Update State
        App.data.teamA = App.data.teams.find(t => t.teamId === idA);
        App.data.teamB = App.data.teams.find(t => t.teamId === idB);

        // Update UI Table immediately
        Renderer.updateMatchupTable();
    }

    if(selA) selA.addEventListener('change', handleTeamChange);
    if(selB) selB.addEventListener('change', handleTeamChange);

    // B. Run Simulation Button
    const runBtns = [
        document.getElementById(DOM_IDS.runBtn), 
        document.getElementById(DOM_IDS.mobileRunBtn)
    ];

    runBtns.forEach(btn => {
        if(btn) {
            btn.addEventListener('click', () => {
                // 1. Validation
                if (!App.data.teamA || !App.data.teamB) {
                    alert("Please select two teams.");
                    return;
                }

                // 2. Gather Inputs
                const factors = InputManager.getFactors();
                App.inputs.factors = factors; // Save for debugging

                // 3. Run Engine
                Engine.run(App.data.teamA, App.data.teamB, factors);

                // 4. Render Text/Table Results
                Renderer.renderResults();

                // 5. Trigger Physics Animation
                if (typeof dropBalls === 'function') {
                    dropBalls();
                }

                // 6. Mobile Logic (Close sidebar if open)
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            });
        }
    });

    // --- Helpers ---
    function populateTeamSelects() {
        const teams = App.data.teams;
        // Sort alphabetically
        teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
        
        let options = '<option value="">-- Select Team --</option>';
        teams.forEach(t => {
            options += `<option value="${t.teamId}">${t.teamName}</option>`;
        });

        if(selA) selA.innerHTML = options;
        if(selB) selB.innerHTML = options;
    }
});
