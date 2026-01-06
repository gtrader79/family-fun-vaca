/* JS Start */
const tbody = document.getElementById('analytics-stats-table-body');
tbody.innerHTML = '';

// 1. Confidence Interval Calculation
const floor = summaryMetrics.p2_5.toFixed(1);
const ceiling = summaryMetrics.p97_5.toFixed(1);
let confText = (summaryMetrics.p2_5 > 0) 
    ? `${teamA.teamName} wins by ${floor} to ${ceiling}.`
    : (summaryMetrics.p97_5 < 0)
    ? `${teamB.teamName} wins by ${Math.abs(ceiling)} to ${Math.abs(floor)}.`
    : `Anything from ${teamB.teamName} by ${Math.abs(floor)} to ${teamA.teamName} by ${ceiling}.`;

// 2. Frangibility Calculation
const iqr = summaryMetrics.p75 - summaryMetrics.p25;
const winMargin = Math.abs(summaryMetrics.teamAWinProb - 0.5);
let stability = { label: "Moderate", color: "text-warning" };

if (winMargin < 0.07 && iqr > 16) {
    stability = { label: "High (Fragile)", color: "text-danger" };
} else if (winMargin > 0.15) {
    stability = { label: "Low (Stable)", color: "text-success" };
}

// 3. Constructing the Rows
const rows = [
    { label: "Win Probability", val: `${(summaryMetrics.teamAWinProb * 100).toFixed(1)}% for ${teamA.teamName}` },
    { label: "95% Confidence Range", val: confText },
    { label: "Matchup Frangibility", val: `<span class="${stability.color}">${stability.label}</span>` },
    { label: "Key X-Factor", val: xFactorNarrative }
];

rows.forEach(row => {
    tbody.innerHTML += `<tr>
        <td style="width: 30%"><strong>${row.label}</strong></td>
        <td>${row.val}</td>
    </tr>`;
});
/* JS End */
