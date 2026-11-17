/**
 * ============================================================================
 * step1_plot.js - Step 1: Plot Dimensions & Geometry Configuration
 * ============================================================================
 */

function setPlotType(type) {
    state.plotType = type;
    const btnProper = document.getElementById('btn-proper');
    const btnTilt = document.getElementById('btn-tilt');
    const properInputs = document.getElementById('proper-inputs');
    const tiltInputs = document.getElementById('tilt-inputs');

    if (type === 'proper') {
        if (btnProper) btnProper.className = "flex-1 py-2 border-2 border-blue-500 bg-blue-50 text-blue-700 rounded-md font-medium transition cursor-pointer";
        if (btnTilt) btnTilt.className = "flex-1 py-2 border-2 border-gray-200 bg-gray-50 text-gray-500 rounded-md font-medium transition cursor-pointer";
        if (properInputs) properInputs.classList.remove('hidden');
        if (tiltInputs) tiltInputs.classList.add('hidden');
    } else {
        if (btnTilt) btnTilt.className = "flex-1 py-2 border-2 border-blue-500 bg-blue-50 text-blue-700 rounded-md font-medium transition cursor-pointer";
        if (btnProper) btnProper.className = "flex-1 py-2 border-2 border-gray-200 bg-gray-50 text-gray-500 rounded-md font-medium transition cursor-pointer";
        if (properInputs) properInputs.classList.add('hidden');
        if (tiltInputs) tiltInputs.classList.remove('hidden');
    }

    if (typeof updateUI === 'function') updateUI();
}

// Global Export
window.setPlotType = setPlotType;
