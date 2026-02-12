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
    getZ: function(val, stats, invert = false) {
        const z = (val - stats.avg) / stats.stdDev;
        return invert ? -z : z;
    },

    // Pre-calculate the Normalization Factor (Sigma)     
    calculateNormalizationFactor: function(weights) {
        console.log("Initializing Normalization Factor...");
        let sumSquares = 0;
                
        for (let key in weights) {
            sumSquares += (weights[key] * weights[key]);
        }

        // Multiply by sqrt(2) because we are comparing two independent variables (Team A vs Team B)
        const sigma = Math.sqrt(sumSquares) * 1.414;
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
