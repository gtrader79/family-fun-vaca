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
            hfa: this.getStr(DOM_IDS.hfa),
            gameMatchUpType: this.getStr(DOM_IDS.matchup),
            travel: this.getStr(DOM_IDS.travel),
            windLevel: this.getStr(DOM_IDS.wind),
            rainLevel: this.getStr(DOM_IDS.rain),
            momentum: this.getStr(DOM_IDS.momentum),
            sosAdjustment: this.getStr(DOM_IDS.sos)
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