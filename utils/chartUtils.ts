
/**
 * Ensures a Chart.js configuration object has default styling to prevent invisible charts.
 * @param config - The Chart.js configuration object from the AI.
 * @returns A new configuration object with guaranteed styling.
 */
export const ensureChartStyling = (config) => {
    const newConfig = JSON.parse(JSON.stringify(config)); // Deep copy
    const themeColors = [
        'rgba(0, 242, 254, 0.7)', // primary-glow
        'rgba(166, 74, 255, 0.7)', // secondary-glow
        'rgba(255, 205, 86, 0.7)', // yellow
        'rgba(75, 192, 192, 0.7)',  // teal
        'rgba(255, 99, 132, 0.7)',  // red
        'rgba(54, 162, 235, 0.7)',  // blue
    ];
    const borderColors = themeColors.map(c => c.replace('0.7', '1'));

    if (newConfig.data && newConfig.data.datasets) {
        newConfig.data.datasets.forEach((dataset, index) => {
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = (newConfig.type === 'pie' || newConfig.type === 'doughnut') 
                    ? themeColors 
                    : themeColors[index % themeColors.length];
            }
            if (!dataset.borderColor) {
                dataset.borderColor = borderColors[index % borderColors.length];
            }
            if (dataset.borderWidth === undefined) {
                dataset.borderWidth = 1;
            }
        });
    }
    
    // Set default options for all charts to ensure responsiveness and proper sizing.
    if (!newConfig.options) {
        newConfig.options = {};
    }
    newConfig.options = {
        responsive: true,
        maintainAspectRatio: false, // This is critical for charts in flexible containers
        ...newConfig.options,
        scales: {
            ...(newConfig.options.scales || {}),
            x: {
                ...(newConfig.options.scales?.x || {}),
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
                ...(newConfig.options.scales?.y || {}),
                ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        },
        plugins: {
            ...(newConfig.options.plugins || {}),
            legend: {
                ...(newConfig.options.plugins?.legend || {}),
                labels: {
                    color: 'rgba(255, 255, 255, 0.8)'
                }
            }
        }
    };


    return newConfig;
};