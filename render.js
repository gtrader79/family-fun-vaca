/* render.js 
    Artist:  read in the App.simulation (populated by engige.js) and update the DOM
*/

const Renderer = {
    
    // 1.All Metrics used     
    metrics : [
        { statNm: "offPoints", label: "Points Scored / gm", key: "off_points_scored_per_game", rank: "off_points_scored_per_game_rank", better: "Higher", category: "Core", c:1},
        { statNm: "offPass", label: "Pass Yds / gm", key: "off_pass_yards_per_game", rank: "off_pass_yards_per_game_rank", better: "Higher", category: "Core", c:1},
        { statNm: "offRush", label: "Rush Yds / gm", key: "off_rush_yards_per_game", rank: "off_rush_yards_per_game_rank", better: "Higher", category: "Core", c:1},
        { statNm: "offQB", label: "QB Rating", key: "off_passer_rating", rank: "off_passer_rating_rank", better: "Higher", category: "Position", c:2},
        { statNm: "offTE", label: "TE Yds / gm", key: "off_te_yards_per_game", rank: "off_te_performance_rank", better: "Higher", category: "Position", c:2},
        { statNm: "offWR", label: "WR Yds / gm", key: "off_wr_yards_per_game", rank: "off_wr_performance_rank", better: "Higher", category: "Position", c:2},
        { statNm: "offTurnOver", label: "Turnovers / gm", key: "off_turnovers_per_game", rank: "off_turnovers_rank", better: "Lower", category: "Turnovers / Penalties", c:5},
        { statNm: "offRZ", label: "Red Zone Efficiency %", key: "off_rz_efficiency_pct", rank: "off_rz_efficiency_rank", better: "Higher", category: "Advanced", c:6},
        { statNm: "offExplosivePlay", label: "Explosive Plays %", key: "off_explosive_play_rate_pct", rank: "off_explosive_play_rate_rank", better: "Higher", category: "Advanced", c:6},
        { statNm: "offPressure", label: "Offensive Pressure Allowed %", key: "off_pressure_allowed_pct", rank: "off_pressure_allowed_rank", better: "Higher", category: "Advanced", c:6},
        { statNm: "off3rdConversion", label: "3rd Down Conversion %", key: "off_3rd_down_pct", rank: "off_3rd_down_rank", better: "Higher", category: "Conversion %", c:3},
        { statNm: "off4thConversion", label: "4th Down Conversion %", key: "off_4th_down_pct", rank: "off_4th_down_rank", better: "Higher", category: "Conversion %", c:3},

        { statNm: "defPoints", label: "Points Allowed", key: "def_points_allowed_per_game", rank: "def_points_rank", better: "Lower", category: "Core", c:1},
        { statNm: "defPass", label: "Def Pass Yds Allowed", key: "def_pass_yards_allowed_per_game", rank: "def_pass_yards_allowed_per_game_rank", better: "Lower", category: "Core", c:1},
        { statNm: "defRush", label: "Def Rush Yds Allowed", key: "def_rush_yards_allowed_per_game", rank: "def_rush_yards_allowed_per_game_rank", better: "Lower", category: "Core", c:1},
        { statNm: "defQB", label: "QB Rating Allowed", key: "def_passer_rating_allowed", rank: "def_passer_rating_rank", better: "Lower", category: "Position", c:2},
        { statNm: "defTE", label: "TE Yds Allowed / gm", key: "def_te_yards_allowed_per_game", rank: "def_te_performance_rank", better: "Lower", category: "Position", c:2},
        { statNm: "defWR", label: "WR Yds Allowed / gm", key: "def_wr_yards_allowed_per_game", rank: "def_wr_performance_rank", better: "Lower", category: "Position", c:2},
        { statNm: "defTurnOver", label: "Turnovers Forced / gm", key: "def_turnovers_forced_per_game", rank: "def_turnovers_rank", better: "Higher", category: "Turnovers / Penalties", c:5},
        { statNm: "defRZ", label: "Red Zone Efficiency Allowed %", key: "def_rz_efficiency_allowed_pct", rank: "def_rz_efficiency_rank", better: "Lower", category: "Advanced", c:6 },
        { statNm: "defExplosivePlay", label: "Explosive Plays Allowed %", key: "def_explosive_play_rate_allowed_pct", rank: "def_explosive_play_rate_rank", better: "Lower", category: "Advanced", c:6},
        { statNm: "defPressure", label: "Defensive Pressure Generated %", key: "def_pressure_generated_pct", rank: "def_pressure_generated_rank", better: "Lower", category: "Advanced", c:6},
        { statNm: "def3rdConversion", label: "3rd Down Conversion Allowed %", key: "def_3rd_down_allowed_pct", rank: "def_3rd_down_rank", better: "Lower", category: "Conversion %", c:3},
        { statNm: "def4thConversion", label: "4th Down Conversion Allowed %", key: "def_4th_down_allowed_pct", rank: "def_4th_down_rank", better: "Lower", category: "Conversion %", c:3},


        { statNm: "offStartingFieldPos", label: "Offensive Avg Field Pos", key: "off_avg_starting_field_pos", rank: "off_avg_starting_field_pos_rank", better: "Higher", category: "Special Teams", c:4},
        { statNm: "defStartingFieldPos", label: "Def Avg Field Pos Allowed", key: "def_avg_starting_field_pos_allowed", rank: "def_avg_starting_field_pos_rank", better: "Lower", category: "Special Teams", c:4},
        { statNm: "offPen", label: "Offensive Penalties / gm", key: "off_penalties_per_game", rank: "off_penalties_freq_rank", better: "Lower", category: "Turnovers / Penalties", c:1},
        { statNm: "offYdsPerPen", label: "Offensive Yds / penalty", key: "off_penalty_yards_per_penalty", rank: "off_penalty_severity_rank", better: "Lower", category: "Turnovers / Penalties", c:5}, 
        { statNm: "defPen", label: "Defensive Penalties / gm", key: "def_penalties_per_game", rank: "def_penalties_freq_rank", better: "Lower", category: "Turnovers / Penalties", c:5},
        { statNm: "defYdsPerPen", label: "Defensive Yds / penalty", key: "def_penalty_yards_per_penalty", rank: "def_penalty_severity_rank", better: "Lower", category: "Turnovers / Penalties", c:5},

        { statNm: "FieldGoalPrct", label: "Field Goal %", key: "off_fg_accuracy_pct", rank: "off_fg_accuracy_rank", better: "Higher", category: "Special Teams", c:4},
        { statNm: "strengthOfSchedule", label: "Field Goal %", key: "off_fg_accuracy_pct", rank: "off_fg_accuracy_rank", better: "Higher", category: "Special Teams", c:6}
    ],  

    // 2. Update the "Tale of the Tape" (Pre-Sim Table)
    updateMatchupTable: function() {
        const tA = App.data.teamA;
        const tB = App.data.teamB;
        if (!tA || !tB) return;

        // Helper to colorize advantages
        const getAdvantage = (valA, valB, betterDir) => {
            //const diff = betterDir === 'Lower' ? valB - valA : valA - valB;

            const diff = valB - valA;
            if (Math.abs(diff) == 0) return `<span class="neutral" style="color:#888;">Even</span>`; 
            
            return diff < 0 
                ? `<span class="team-b-adv" style="color:${tB.primaryColor}; font-weight:bold;">+${Math.abs(diff).toFixed(0)} ${tB.teamId}</span>` 
                : `<span class="team-a-adv" style="color:${tA.primaryColor}; font-weight:bold;">+${Math.abs(diff).toFixed(0)} ${tA.teamId}</span>`;
        };

        const tableBody = document.getElementById('matchup-table-body');
        if (!tableBody) return;

        //Group by c for easier read.  c is a numerical grouping of the category
        const groupedMetrics = Object.groupBy(this.metrics, m => m.c);
        
        let html = '';

        // Object.entries returns [key, value] where 'items' is the array of metrics for that 'c' value
        for (const [groupCode, items] of Object.entries(groupedMetrics)) {
            const categoryName = items[0].category; // Corrected: access first item in array
        
            // 1. HEADER ROW - Added toggle function
            html += `
                <tr class="accordion-header" style="cursor:pointer;" 
                    onclick="Renderer.toggleTableGroup('${groupCode}', this)">
                    <td colspan="4">
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                            <span>${categoryName}</span>
                            <span class="arrow">▼</span>
                        </div>
                    </td>
                </tr>
            `;
        
            // 2. DATA ROWS - Default to 'display: none'
            items.forEach(m => {
                html += `
                    <tr class="accordion-content group-${groupCode}" style="display: none;">
                        <td>${m.label}</td>
                        <td>${tA[m.key] || '-'} (${Utils.toOrdinal(tA[m.rank])})</td>
                        <td>${tB[m.key] || '-'} (${Utils.toOrdinal(tB[m.rank])})</td>
                        <td>${getAdvantage(tA[m.rank], tB[m.rank], tA[m.better])}</td>
                    </tr>
                `;
            });
        }

        tableBody.innerHTML = html;
        
        // Update Headers
        document.getElementById('table-header-a').innerText = tA.teamName;
        document.getElementById('table-header-b').innerText = tB.teamName;
    },

    //1b. "Tale of Tape" function for accordion structure
    toggleTableGroup: function(groupCode, headerElement) {
        headerElement.classList.toggle('active');
        const rows = document.querySelectorAll(`.group-${groupCode}`);
        rows.forEach(row => {
            row.style.display = (row.style.display === 'none') ? 'table-row' : 'none';
        });
    },

    // 2. Main Result Renderer (Post-Sim)
    renderResults: function() {
        const summary = App.simulation.summary;
        const tA = App.data.teamA;
        const tB = App.data.teamB;

        // A. Win Probability Text
        //const resultContainer = document.getElementById('simulation-text-results'); // Ensure this ID exists in HTML
        const resultContainer = document.getElementById('win-prob-display');
        if (resultContainer) {
            const winner = summary.winProbA > summary.winProbB ? tA : tB;
            const pct = Math.max(summary.winProbA, summary.winProbB) * 100;
            
            resultContainer.innerHTML = `
                <div class="result-header">
                    <h3>Projected Winner: <span style="color:${winner.primaryColor}">${winner.teamName}</span></h3>
                    <h1>${pct.toFixed(1)}% Win Probability</h1>
                </div>
            `;
        }

        // B. Analytics Table (Keys to Victory, Risk, Tornado)
        this.renderAnalyticsTable();
    },

    renderAnalyticsTable: function() {
        const tbody = document.getElementById('analytics-stats-table-body');
        if (!tbody) return;
        tbody.innerHTML = ''; // Clear old

        const tA = App.data.teamA;
        const tB = App.data.teamB;

        // 1. Generate Tornado Chart (Matchup DNA)
        const tornadoHTML = this.generateTornadoChart();

        // 2. Generate Keys to Victory
        const keys = this.getKeysToVictory();

        // 3. Generate Frangibility (Risk)
        const risk = this.getFrangibility();

        const rows = [
            { label: "Keys to Victory", val: keys },
            { label: "Matchup DNA", val: tornadoHTML },
            { label: "Risk Level", val: risk }
        ];

        rows.forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td style="width:25%; font-weight:bold;">${r.label}</td>
                    <td>${r.val}</td>
                </tr>`;
        });
    },

    // Generates the Bar Chart HTML
    generateTornadoChart: function() {
        const tA = App.data.teamA;
        const tB = App.data.teamB;
        const weights = SIM_CONFIG.weights;
        
        let html = '<div class="tornado-container" style="display:flex; flex-direction:column; gap:5px;">';
        
        // Calculate raw advantages per category
        // (This logic mirrors the Engine, but for display purposes)
        for (let [key, weight] of Object.entries(weights)) {
            let valA = tA.stats[key] || 0;
            let valB = tB.stats[key] || 0;
            
            // Adjust for Injuries (Using global simulation state if available, or raw)
            // Ideally, we read from App.inputs to get injury status, but for now we use raw stats + weight
            
            let diff = (valA - valB) * weight; 
            let width = Math.min(Math.abs(diff) * 20, 100); // Scale for visual
            let color = diff > 0 ? tA.primaryColor : tB.primaryColor;
            let align = diff > 0 ? 'flex-start' : 'flex-end'; // This is a simple bar, not a split axis for simplicity
            
            // Simplified Visual: Just a bar showing who has the edge
            html += `
                <div style="display:flex; align-items:center; font-size:12px;">
                    <div style="width:100px; text-align:right; padding-right:10px;">${key.toUpperCase()}</div>
                    <div style="flex-grow:1; background:#eee; height:10px; border-radius:5px; position:relative;">
                        <div style="
                            position:absolute; 
                            left: 50%;
                            width: ${width/2}%; 
                            height:100%; 
                            background:${color};
                            ${diff < 0 ? 'transform: translateX(-100%);' : ''}
                        "></div>
                    </div>
                </div>
            `;
        }
        html += '</div>';
        return html;
    },

    getKeysToVictory: function() {
        const tA = App.data.teamA;
        const tB = App.data.teamB;
        // Simple logic: What is their best stat?
        // You can make this smarter later
        return `
            <ul style="margin: 0; padding-left: 15px;">
                <li><strong>${tA.teamId}:</strong> Win the turnover battle.</li>
                <li><strong>${tB.teamId}:</strong> Control the clock.</li>
            </ul>
        `;
    },

    getFrangibility: function() {
        const stdDev = App.simulation.summary.stdDev || 13; // Default fall back
        
        if (stdDev > 16) return `<span style="color:red"><strong>High Variance</strong></span><br><small>Wild swings likely.</small>`;
        if (stdDev < 10) return `<span style="color:green"><strong>Stable</strong></span><br><small>Predictable outcome.</small>`;
        return `<span style="color:orange"><strong>Moderate</strong></span><br><small>Standard NFL variance.</small>`;
    }
};
