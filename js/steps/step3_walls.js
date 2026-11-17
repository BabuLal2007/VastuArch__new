/**
 * ============================================================================
 * step3_walls.js - Step 3: Walls, Partitions, Doors, Windows, Balcony & Vastu
 * ============================================================================
 */

function toggleDimensions() {
    const dimToggle = document.getElementById('dimensions-toggle');
    if (dimToggle) state.showDimensions = dimToggle.checked;
    if (typeof draw2D === 'function') draw2D();
}

function toggleVastu() {
    const vastuToggle = document.getElementById('vastu-toggle');
    if (vastuToggle) state.showVastu = vastuToggle.checked;
    if (typeof draw2D === 'function') draw2D();
}

function clearMeasurements() {
    if (typeof saveHistory === 'function') saveHistory();
    state.measurements = [];
    if (typeof resetMeasureState === 'function') resetMeasureState();
    if (typeof draw2D === 'function') draw2D();
}

function changeSelectedBalconyHeight(h) {
    if (!state.selectedObj || !state.selectedObj.item) return;
    const item = state.selectedObj.item;
    if (item.type === 'balcony_wall' || item.wallType === 'balcony') {
        if (typeof saveHistory === 'function') saveHistory();
        item.heightFt = parseFloat(h) || 3;
        const badge = document.getElementById('balcony-height-badge');
        if (badge) badge.innerText = item.heightFt + ' ft';
        if (typeof draw2D === 'function') draw2D();
        if (typeof generate3D === 'function') generate3D();
    }
}

// Global Exports
window.toggleDimensions = toggleDimensions;
window.toggleVastu = toggleVastu;
window.clearMeasurements = clearMeasurements;
window.changeSelectedBalconyHeight = changeSelectedBalconyHeight;
