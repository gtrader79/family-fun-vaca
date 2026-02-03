/* utils.js 
    The Helpers:  Math helpers.  No HTML; No Team logic
*/

const Utils = {
    // Standard Normal Distribution (Box-Muller transform)
    //Replacement for the generateNoise function.  Allows for true Normal Distribution.  Generic Math.random() gives uniform distribution.
    boxMuller: function() {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },

    generateNoise: (lvl) => (Math.random() * 2 - 1) * lvl,

    // Sigmoid function to squash results between 0 and 1
    sigmoid: function(z, k) {
        return 1 / (1 + Math.exp(-k * z));
    },

    // Calculate Z-Score
    getZ: function(val, mean, std) {
        if (std === 0) return 0;
        return (val - mean) / std;
    },

    // Pre-calculate the Normalization Factor (Sigma)     
    calculateNormalizationFactor: function(weights, iterations) {
        console.log("Initializing Normalization Factor...");
        let sumSqDiff = 0;
        
        // We simulate a "Standard" matchup to see natural variance
        for (let i = 0; i < iterations; i++) {
            let score = 0;
            // Iterate over weights to generate random variance
            for (let key in weights) {
                // Random noise for each stat category
                let r = (Math.random() - 0.5) * 2; // -1 to 1
                score += r * weights[key];
            }
            sumSqDiff += score * score;
        }
        
        const variance = sumSqDiff / iterations;
        const sigma = Math.sqrt(variance);
        console.log("Normalization Factor (Sigma):", sigma);
        return sigma;
    },

    //Stats
    getStats: (values) => {
        const n = values.length;
        const avg = values.reduce((a, b) => a + b, 0) / n;
        const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / n);
        return { avg, stdDev };
    },
    //Percentiles
    getPercentile: (arr, p) => {
        const idx = (p / 100) * (arr.length - 1);
        const low = Math.floor(idx), high = Math.ceil(idx), w = idx - low;
        return arr[low] + w * (arr[high] - arr[low]);
    },
    
    toOrdinal: (n) => {
        const absN = Math.abs(n);
        const v = absN % 100;
        const suffix = (v >= 11 && v <= 13) ? "th" : 
                       (absN % 10 === 1) ? "st" : 
                       (absN % 10 === 2) ? "nd" : 
                       (absN % 10 === 3) ? "rd" : "th";
        return n + suffix;
    }
    
};
