/* inputs.js 
    The Bridge:  Reads the HTML & returns Data
*/

const InputManager = {
    // Helper to safely get value by ID
    getVal: function(id) {
        const el = document.getElementById(id);
        return el ? parseFloat(el.value) : 0;
    },

    // Helper to safely get text/select value
    getStr: function(id) {
        const el = document.getElementById(id);
        return el ? el.value : null;
    },

    // Main function to gather all User Inputs
    getFactors: function() {
        // 1. Gather Context
        const context = {
            hfa: this.getVal(DOM_IDS.hfa),
            gameMatchUpType: this.getVal(DOM_IDS.matchup),
            travel: this.getVal(DOM_IDS.travel),
            windLevel: this.getVal(DOM_IDS.wind),
            rainLevel: this.getVal(DOM_IDS.rain),
            momentum: this.getVal(DOM_IDS.momentum),
            sosAdjustment: this.getVal(DOM_IDS.sos),
            divisionMatchup: (App.data.teamA.division == App.data.teamB.division),
            teamA_Rest: this.getVal(DOM_IDS.rest.teamA),
            teamB_Rest: this.getVal(DOM_IDS.rest.teamB)
        };

        // 2. Gather Injuries for Team A
        const injA = {};
        for (let [pos, id] of Object.entries(DOM_IDS.injuriesA)) {
            injA[pos] = this.getVal(id);
        }

        // 3. Gather Injuries for Team B
        const injB = {};
        for (let [pos, id] of Object.entries(DOM_IDS.injuriesB)) {
            injB[pos] = this.getVal(id);
        }

        return {
            context: context,
            injuriesA: injA,
            injuriesB: injB
        };
    }
};
