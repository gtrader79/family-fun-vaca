/* state.js 
    Central Truth - used for debugging in Console
*/

const App = {
    // Raw Data loaded from teams.json
    data: {
        teams: [],
        leagueMetrics: null,   //Stats per metric
        teamA: null,    // The actual Team Object
        teamB: null
    },
    
    // Inputs from the User (Last run)
    inputs: {
        factors: null
    },    

    // Simulation Output
    simulation: {
        normalizationFactor: 0, // Calculated once on load
        results: [],     // Raw Delta array
        runs: [],        // Detailed run data (for Visuals/Physics)
        summary: {       // Calculated Stats
            winProbA: 0,
            winProbB: 0,
            meanMargin: 0,
            stdDev: 0
        },
        keysToSuccess: {} // Text explanation
    }
};
