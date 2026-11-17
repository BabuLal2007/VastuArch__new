/**
 * ============================================================================
 * step2_roads.js - Step 2: Road Orientation, Main Door & Compound Wall
 * ============================================================================
 */

function toggleCompoundWall(enabled) {
    if (!state.compound) state.compound = {};
    state.compound.enabled = !!enabled;

    const container = document.getElementById('compound-settings-container');
    if (container) {
        if (enabled) container.classList.remove('hidden');
        else container.classList.add('hidden');
    }

    if (typeof saveStateData === 'function') saveStateData();
    if (typeof draw2D === 'function') draw2D();
    if (typeof generate3D === 'function') generate3D();
    if (typeof showToast === 'function') {
        showToast(enabled ? 'Compound Wall & Entrance Gate Enabled' : 'Compound Wall Disabled', enabled ? 'success' : 'info');
    }
}

function updateCompoundSettings() {
    if (typeof saveStateData === 'function') saveStateData();
    const hValEl = document.getElementById('compound-height-val');
    if (hValEl && state.compound) {
        hValEl.innerText = (state.compound.heightFt || 5.0).toFixed(1) + ' ft';
    }
    if (typeof draw2D === 'function') draw2D();
    if (typeof generate3D === 'function') generate3D();
}

// Global Exports
window.toggleCompoundWall = toggleCompoundWall;
window.updateCompoundSettings = updateCompoundSettings;
