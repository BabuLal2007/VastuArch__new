/**
 * ============================================================================
 * step5_furniture.js - Step 5: Furniture, Decor, Materials & MEP Layer
 * ============================================================================
 */

function switchStep5Tab(tab) {
    const furnTab = document.getElementById('step5-tab-furn');
    const matTab = document.getElementById('step5-tab-mat');
    const mepTab = document.getElementById('step5-tab-mep');
    const furnPanel = document.getElementById('step5-furniture-panel');
    const matPanel = document.getElementById('step5-materials-panel');
    const mepPanel = document.getElementById('step5-mep-panel');

    const inactiveClass = "flex-1 py-1.5 text-xs font-bold rounded-lg text-gray-500 hover:text-gray-700 transition cursor-pointer flex items-center justify-center gap-1";
    const activeClassBlue = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-blue-700 shadow-xs transition cursor-pointer flex items-center justify-center gap-1";
    const activeClassTeal = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-teal-700 shadow-xs transition cursor-pointer flex items-center justify-center gap-1";

    if (furnPanel) furnPanel.classList.add('hidden');
    if (matPanel) matPanel.classList.add('hidden');
    if (mepPanel) mepPanel.classList.add('hidden');

    if (furnTab) furnTab.className = inactiveClass;
    if (matTab) matTab.className = inactiveClass;
    if (mepTab) mepTab.className = inactiveClass;

    if (tab === 'materials') {
        if (matPanel) matPanel.classList.remove('hidden');
        if (matTab) matTab.className = activeClassBlue;
    } else if (tab === 'mep') {
        if (mepPanel) mepPanel.classList.remove('hidden');
        if (mepTab) mepTab.className = activeClassTeal;
        if (!state.showMepLayer && typeof toggleMepLayer === 'function') {
            toggleMepLayer(true);
        }
    } else {
        if (furnPanel) furnPanel.classList.remove('hidden');
        if (furnTab) furnTab.className = activeClassBlue;
    }
}

function toggleMepLayer(forceState = null) {
    if (forceState !== null) {
        state.showMepLayer = !!forceState;
    } else {
        state.showMepLayer = !state.showMepLayer;
    }

    const btn = document.getElementById('btn-mep-layer');
    const palette = document.getElementById('mep-floating-palette');

    if (state.showMepLayer) {
        if (btn) {
            btn.className = "px-3.5 py-2 bg-teal-600 text-white shadow-md border-r border-teal-700 text-sm font-bold flex items-center transition cursor-pointer active";
        }
        if (palette) palette.classList.remove('hidden');
        const mepLabel = document.getElementById('mep-active-floor-label');
        if (mepLabel && state.floors && state.floors[state.currentFloorIndex]) {
            mepLabel.textContent = `${state.floors[state.currentFloorIndex].name} Floor`;
        }
        if (typeof showToast === 'function') {
            showToast('MEP Layer Enabled (Electrical, Plumbing & Sanitary Layout)', 'success');
        }
    } else {
        if (btn) {
            btn.className = "px-3.5 py-2 bg-white text-teal-700 hover:bg-teal-50 text-sm font-bold flex items-center transition border-r border-gray-200 cursor-pointer";
        }
        if (palette) palette.classList.add('hidden');
        if (state.drawMode && state.drawMode.startsWith('mep_')) {
            if (typeof setDrawMode === 'function') setDrawMode('edit');
        }
        if (typeof showToast === 'function') {
            showToast('MEP Layer Hidden', 'info');
        }
    }

    if (state.step === 6 && typeof generate3D === 'function') {
        generate3D();
    }
    if (typeof draw2D === 'function') {
        draw2D();
    }
}

function clearMepAssetsOnFloor() {
    const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
    if (!curFloor) return;
    if (!curFloor.mepAssets || curFloor.mepAssets.length === 0) {
        if (typeof showToast === 'function') showToast('No MEP fixtures on this floor.', 'info');
        return;
    }
    if (confirm(`Remove all MEP fixtures on ${curFloor.name} floor?`)) {
        if (typeof saveHistory === 'function') saveHistory();
        curFloor.mepAssets = [];
        if (typeof draw2D === 'function') draw2D();
        if (state.step === 6 && typeof generate3D === 'function') generate3D();
        if (typeof showToast === 'function') showToast(`Cleared all MEP fixtures on ${curFloor.name} floor.`, 'info');
    }
}

// Global Exports
window.switchStep5Tab = switchStep5Tab;
window.toggleMepLayer = toggleMepLayer;
window.clearMepAssetsOnFloor = clearMepAssetsOnFloor;
