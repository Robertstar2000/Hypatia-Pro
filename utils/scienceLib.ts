/**
 * Science Library for AI Coder Agent
 * Provides a set of constants and functions for physical and chemical simulations.
 */

export const SCIENCE_LIB = `
const science = {
    physics: {
        G: 6.67430e-11, // Gravitational constant
        c: 299792458,   // Speed of light
        g: 9.80665,     // Standard gravity
        k_B: 1.380649e-23, // Boltzmann constant
        
        calculateGravity: (m1, m2, r) => (6.67430e-11 * m1 * m2) / (r * r),
        calculateForce: (m, a) => m * a,
        calculateKineticEnergy: (m, v) => 0.5 * m * v * v,
        calculatePotentialEnergy: (m, h, g = 9.80665) => m * g * h,
        calculateVelocity: (v0, a, t) => v0 + a * t,
        calculateDisplacement: (v0, a, t) => v0 * t + 0.5 * a * t * t,
        calculatePressure: (f, a) => f / a,
        calculateDensity: (m, v) => m / v
    },
    chemistry: {
        R: 8.3144626, // Ideal gas constant
        N_A: 6.02214076e23, // Avogadro constant
        
        calculateMolarity: (moles, volume) => moles / volume,
        calculatePH: (hConcentration) => -Math.log10(hConcentration),
        calculateHConcentration: (ph) => Math.pow(10, -ph),
        calculateReactionRate: (k, concentrations) => {
            return k * concentrations.reduce((acc, c) => acc * c, 1);
        },
        calculateIdealGas: (p, v, n, t) => {
            if (p === null) return (n * 8.3144626 * t) / v;
            if (v === null) return (n * 8.3144626 * t) / p;
            if (n === null) return (p * v) / (8.3144626 * t);
            if (t === null) return (p * v) / (n * 8.3144626);
            return null;
        },
        calculateArrhenius: (A, Ea, T) => A * Math.exp(-Ea / (8.3144626 * T))
    },
    stats: {
        normalRandom: (mean = 0, stdDev = 1) => {
            const u = 1 - Math.random();
            const v = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            return z * stdDev + mean;
        },
        clamp: (val, min, max) => Math.min(Math.max(val, min), max),
        lerp: (a, b, t) => a + (b - a) * t,
        noise: (val, intensity = 0.05) => val * (1 + (Math.random() * 2 - 1) * intensity)
    }
};
`;
