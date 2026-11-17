/**
 * ============================================================================
 * app.js - Application Initialization, UI Controller & Global Event Listeners
 * ============================================================================
 */

const totalSteps = 6;

function updateUI() {
    for (let i = 1; i <= totalSteps; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        if (stepEl) stepEl.classList.remove('active');

        const navBtn = document.getElementById(`nav-step-${i}`);
        if (navBtn) {
            if (i === state.step) {
                navBtn.className = "nav-btn w-12 h-12 flex items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 transition-all duration-200 cursor-pointer active";
            } else {
                navBtn.className = "nav-btn w-12 h-12 flex items-center justify-center rounded-xl text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 cursor-pointer";
                navBtn.classList.remove('active');
            }
        }
    }
    const currentStepEl = document.getElementById(`step-${state.step}`);
    if (currentStepEl) currentStepEl.classList.add('active');

    const stepIndicator = document.getElementById('step-indicator');
    if (stepIndicator) stepIndicator.innerText = `Step ${state.step}/${totalSteps}`;

    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) btnPrev.style.display = state.step > 1 ? 'block' : 'none';

    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
        btnNext.classList.remove('w-full');
        if (state.step === totalSteps) {
            btnNext.style.display = 'none';
        } else {
            btnNext.style.display = 'block';
            btnNext.innerHTML = `Next Step <i class="fa-solid fa-arrow-right ml-1"></i>`;
        }
        if (state.step === 1) btnNext.classList.add('w-full');
    }

    const btnDownload = document.getElementById('btn-download');
    if (state.step === 6) {
        if (typeof switchView === 'function') switchView('3d');
        if (btnDownload) btnDownload.style.display = 'none';
    } else {
        if (typeof switchView === 'function') switchView('2d');
        if (btnDownload) btnDownload.style.display = 'flex';
    }

    if (state.step === 3 && !['wall', 'balcony_wall', 'door', 'window', 'room', 'edit', 'measure'].includes(state.drawMode)) {
        setDrawMode('wall');
    } else if (state.step === 4 && !['asset_slab', 'asset_stair', 'asset_pillar', 'edit', 'measure'].includes(state.drawMode)) {
        setDrawMode('asset_slab');
    } else if (state.step === 5 && !['furn_bed', 'furn_almira', 'furn_sofa', 'furn_dining', 'edit', 'measure'].includes(state.drawMode)) {
        setDrawMode('furn_bed');
    }

    if (typeof deselectObject === 'function') deselectObject();
    saveStateData();
    if (state.step <= 2 && typeof calculateBoundary === 'function') calculateBoundary();
    renderFloorButtons();
    if (typeof draw2D === 'function') draw2D();
    if (typeof updateCostEstimator === 'function') updateCostEstimator();
    if (typeof updateMaterialUI === 'function') updateMaterialUI();
}

function saveStateData() {
    const plotW = document.getElementById('plot-width');
    const plotL = document.getElementById('plot-length');
    if (plotW) state.dimensions.w = parseFloat(plotW.value) || 30;
    if (plotL) state.dimensions.l = parseFloat(plotL.value) || 50;

    const tiltF = document.getElementById('tilt-front');
    const tiltB = document.getElementById('tilt-back');
    const tiltL = document.getElementById('tilt-left');
    const tiltR = document.getElementById('tilt-right');
    if (tiltF) state.tiltDimensions.front = parseFloat(tiltF.value) || 30;
    if (tiltB) state.tiltDimensions.back = parseFloat(tiltB.value) || 32;
    if (tiltL) state.tiltDimensions.left = parseFloat(tiltL.value) || 50;
    if (tiltR) state.tiltDimensions.right = parseFloat(tiltR.value) || 52;

    const roadF = document.getElementById('road-front');
    const roadB = document.getElementById('road-back');
    const roadL = document.getElementById('road-left');
    const roadR = document.getElementById('road-right');
    if (roadF) state.roads.front = roadF.checked;
    if (roadB) state.roads.back = roadB.checked;
    if (roadL) state.roads.left = roadL.checked;
    if (roadR) state.roads.right = roadR.checked;

    const doorDir = document.getElementById('door-direction');
    if (doorDir) state.door = doorDir.value;

    const compoundEnable = document.getElementById('compound-wall-enable');
    if (compoundEnable) {
        if (!state.compound) state.compound = {};
        state.compound.enabled = !!compoundEnable.checked;

        if (!state.compound.setbacks) state.compound.setbacks = {};
        const sF = document.getElementById('compound-setback-front');
        const sB = document.getElementById('compound-setback-back');
        const sL = document.getElementById('compound-setback-left');
        const sR = document.getElementById('compound-setback-right');
        if (sF) state.compound.setbacks.front = parseFloat(sF.value) || 0;
        if (sB) state.compound.setbacks.back = parseFloat(sB.value) || 0;
        if (sL) state.compound.setbacks.left = parseFloat(sL.value) || 0;
        if (sR) state.compound.setbacks.right = parseFloat(sR.value) || 0;

        const hSlider = document.getElementById('compound-wall-height');
        if (hSlider) state.compound.heightFt = parseFloat(hSlider.value) || 5.0;

        const gStyle = document.getElementById('compound-gate-style');
        if (gStyle) state.compound.gateStyle = gStyle.value || 'sliding';

        const rEnable = document.getElementById('compound-ramp-enable');
        if (rEnable) state.compound.addRamp = !!rEnable.checked;
    }

    if (typeof updateCostEstimator === 'function') updateCostEstimator();
}

function nextStep() {
    if (state.step < totalSteps) {
        state.step++;
        updateUI();
    }
}

function prevStep() {
    if (state.step > 1) {
        state.step--;
        updateUI();
    }
}

function goToStep(stepNumber) {
    if (stepNumber >= 1 && stepNumber <= 6) {
        state.step = stepNumber;
        updateUI();
    }
}

// ----------------------------------------------------------------------------
// Multi-Floor Management System
// ----------------------------------------------------------------------------
function renderFloorButtons() {
    const container = document.getElementById('floor-buttons-list');
    if (!container || !state.floors) return;

    container.innerHTML = state.floors.map((floor, idx) => {
        const isActive = idx === state.currentFloorIndex;
        const btnClass = isActive ?
            "bg-blue-600 text-white font-bold shadow-sm px-2.5 py-1 rounded text-xs transition cursor-pointer" :
            "text-gray-600 hover:text-blue-600 font-medium text-xs px-2.5 py-1 rounded transition cursor-pointer";
        return `<button onclick="switchFloor(${idx})" class="${btnClass}">${floor.name}</button>`;
    }).join('');
}

function switchFloor(index) {
    if (index >= 0 && index < state.floors.length) {
        state.currentFloorIndex = index;
        renderFloorButtons();
        if (typeof renderChajjaList === 'function') renderChajjaList();
        if (typeof deselectObject === 'function') deselectObject();
        if (typeof updateVastuList === 'function') updateVastuList();
        const mepLabel = document.getElementById('mep-active-floor-label');
        if (mepLabel && state.floors[index]) mepLabel.textContent = `${state.floors[index].name} Floor`;
        if (typeof draw2D === 'function') draw2D();
        if (state.step === 6 && typeof generate3D === 'function') generate3D();
        const elevCont = document.getElementById('elevation-container');
        if (elevCont && elevCont.style.display !== 'none' && typeof renderActiveElevation === 'function') {
            renderActiveElevation();
        }
        if (typeof updateCostEstimator === 'function') updateCostEstimator();
    }
}

function addNewFloor() {
    const floorNames = ['Ground', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    const nextIndex = state.floors.length;
    const nextName = floorNames[nextIndex] || `Floor ${nextIndex}`;

    // Get fresh, intact perimeter outer walls for the new floor
    // This guarantees strict floor isolation: doors/windows on other floors do not bleed in
    const cleanWalls = (typeof getCleanOuterWalls === 'function') ? getCleanOuterWalls() : [];

    state.floors.push({
        name: nextName,
        outerWalls: JSON.parse(JSON.stringify(cleanWalls)),
        partitions: [],
        rooms: [],
        assets: [],
        chajjas: [],
        measurements: [],
        mepAssets: [],
        history: []
    });

    switchFloor(nextIndex);
    if (typeof updateCostEstimator === 'function') updateCostEstimator();
}

function removeCurrentFloor() {
    if (!state.floors || state.floors.length <= 1) {
        alert("Cannot delete the Ground floor. At least one floor is required.");
        return;
    }

    const floorToDelete = state.floors[state.currentFloorIndex];
    const confirmMsg = `Are you sure you want to delete "${floorToDelete.name}" floor? All partitions and furniture on this floor will be removed.`;
    if (!confirm(confirmMsg)) return;

    // Delete currently selected floor
    state.floors.splice(state.currentFloorIndex, 1);

    // Re-index remaining floors
    const floorNames = ['Ground', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
    state.floors.forEach((f, idx) => {
        f.name = floorNames[idx] || `Floor ${idx}`;
    });

    // Automatically switch back to the Ground floor (index 0)
    state.currentFloorIndex = 0;

    renderFloorButtons();
    if (typeof renderChajjaList === 'function') renderChajjaList();
    if (typeof deselectObject === 'function') deselectObject();
    if (typeof updateVastuList === 'function') updateVastuList();
    if (typeof draw2D === 'function') draw2D();
    if (state.step === 6 && typeof generate3D === 'function') generate3D();
    const elevCont = document.getElementById('elevation-container');
    if (elevCont && elevCont.style.display !== 'none' && typeof renderActiveElevation === 'function') {
        renderActiveElevation();
    }
    if (typeof updateCostEstimator === 'function') updateCostEstimator();
    updateUI();
}

function setDrawMode(mode) {
    state.drawMode = mode;
    const btnEdit = document.getElementById('btn-edit');
    const btnMeasure = document.getElementById('btn-measure');
    const measureBar = document.getElementById('measure-actions-bar');
    const canvasCont = document.getElementById('canvas-container');

    if (mode === 'edit') {
        if (btnEdit) {
            btnEdit.classList.replace('bg-white', 'bg-indigo-100');
            btnEdit.classList.add('ring-2', 'ring-indigo-400');
        }
        if (canvasCont) canvasCont.style.cursor = 'default';
    } else {
        if (btnEdit) {
            btnEdit.classList.replace('bg-indigo-100', 'bg-white');
            btnEdit.classList.remove('ring-2', 'ring-indigo-400');
        }
        if (typeof deselectObject === 'function') deselectObject();
    }

    if (mode === 'measure') {
        if (btnMeasure) {
            btnMeasure.classList.replace('bg-white', 'bg-pink-100');
            btnMeasure.classList.add('ring-2', 'ring-pink-400');
        }
        if (measureBar) measureBar.classList.remove('hidden');
        if (canvasCont) canvasCont.style.cursor = 'crosshair';
    } else {
        if (btnMeasure) {
            btnMeasure.classList.replace('bg-pink-100', 'bg-white');
            btnMeasure.classList.remove('ring-2', 'ring-pink-400');
        }
        if (measureBar) measureBar.classList.add('hidden');
    }

    if (state.step === 3) {
        const buttons = ['wall', 'balcony_wall', 'door', 'window', 'room'];
        buttons.forEach(btn => {
            const el = document.getElementById(`mode-${btn}`);
            if (el) {
                el.className = btn === mode ?
                    "flex-1 py-1 bg-white shadow-sm rounded text-xs font-bold text-blue-600 border border-gray-200" :
                    "flex-1 py-1 text-xs font-medium text-gray-600 hover:text-blue-600";
            }
        });
        const balconySel = document.getElementById('balcony-selector');
        const roomSel = document.getElementById('room-selector');
        const doorSel = document.getElementById('door-selector');
        if (balconySel) balconySel.classList.toggle('hidden', mode !== 'balcony_wall');
        if (roomSel) roomSel.classList.toggle('hidden', mode !== 'room');
        if (doorSel) doorSel.classList.toggle('hidden', mode !== 'door');
    } else if (state.step === 4) {
        const slabEl = document.getElementById('mode-asset_slab');
        if (slabEl) {
            slabEl.className = mode === 'asset_slab' ?
                "py-2 bg-slate-200 border-2 border-slate-400 rounded-md text-sm font-bold flex flex-col items-center justify-center text-slate-800" :
                "py-2 bg-gray-100 hover:bg-gray-200 border-2 border-transparent rounded-md text-sm font-medium flex flex-col items-center justify-center text-slate-600";
        }

        const stairEl = document.getElementById('mode-asset_stair');
        if (stairEl) {
            stairEl.className = mode === 'asset_stair' ?
                "py-2 bg-amber-100 border-2 border-amber-400 rounded-md text-sm font-bold flex flex-col items-center justify-center text-amber-900" :
                "py-2 bg-gray-100 hover:bg-gray-200 border-2 border-transparent rounded-md text-sm font-medium flex flex-col items-center justify-center text-amber-700";
        }

        const pillarEl = document.getElementById('mode-asset_pillar');
        if (pillarEl) {
            pillarEl.className = mode === 'asset_pillar' ?
                "py-2 bg-indigo-100 border-2 border-indigo-400 rounded-md text-xs font-bold flex flex-col items-center justify-center text-indigo-900" :
                "py-2 bg-gray-100 hover:bg-gray-200 border-2 border-transparent rounded-md text-xs font-medium flex flex-col items-center justify-center text-slate-800";
        }

        const stairSel = document.getElementById('stair-selector');
        const slabSel = document.getElementById('slab-selector');
        const pillarSel = document.getElementById('pillar-selector');
        if (stairSel) stairSel.classList.toggle('hidden', mode !== 'asset_stair');
        if (slabSel) slabSel.classList.toggle('hidden', mode !== 'asset_slab');
        if (pillarSel) pillarSel.classList.toggle('hidden', mode !== 'asset_pillar');
    } else if (state.step === 5) {
        const furnTypes = ['furn_bed', 'furn_almira', 'furn_sofa', 'furn_dining'];
        furnTypes.forEach(type => {
            const el = document.getElementById(`mode-${type}`);
            if (el) {
                if (type === mode) el.classList.add('bg-blue-100', 'border-blue-400');
                else el.classList.remove('bg-blue-100', 'border-blue-400');
            }
        });
        const bedSel = document.getElementById('furn-bed-selector');
        const almiraSel = document.getElementById('furn-almira-selector');
        if (bedSel) bedSel.classList.toggle('hidden', mode !== 'furn_bed');
        if (almiraSel) almiraSel.classList.toggle('hidden', mode !== 'furn_almira');
    }

    // Highlight active MEP tool buttons in floating palette and Step 5 sidebar
    document.querySelectorAll('.mep-tool-btn').forEach(btn => {
        const id = btn.id || '';
        if (id.endsWith(mode)) {
            btn.classList.add('ring-2', 'ring-teal-500', 'border-teal-500', 'bg-teal-50/70');
            btn.classList.remove('border-gray-200', 'bg-white');
        } else {
            btn.classList.remove('ring-2', 'ring-teal-500', 'border-teal-500', 'bg-teal-50/70');
            btn.classList.add('border-gray-200', 'bg-white');
        }
    });

    if (mode && mode.startsWith('mep_')) {
        if (!state.showMepLayer && typeof toggleMepLayer === 'function') {
            toggleMepLayer(true);
        }
    }

    if (mode !== 'edit' && canvasCont) {
        canvasCont.style.cursor = mode === 'room' ? 'pointer' : 'crosshair';
    }
}

// ----------------------------------------------------------------------------
// Bootstrap Application
// ----------------------------------------------------------------------------
window.onload = function () {
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', () => {
            saveStateData();
            if (state.step <= 2 && typeof calculateBoundary === 'function') calculateBoundary();
            if (state.step !== 6) {
                if (typeof draw2D === 'function') draw2D();
            } else {
                if (typeof generate3D === 'function') generate3D();
            }
            const elevCont = document.getElementById('elevation-container');
            if (elevCont && elevCont.style.display !== 'none' && typeof renderActiveElevation === 'function') {
                renderActiveElevation();
            }
            if (typeof updateCostEstimator === 'function') updateCostEstimator();
        });
    });

    ['plot-width', 'plot-length', 'tilt-front', 'tilt-back', 'tilt-left', 'tilt-right', 'custom-cost-rate',
     'compound-setback-front', 'compound-setback-back', 'compound-setback-left', 'compound-setback-right', 'compound-wall-height'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (id === 'custom-cost-rate') {
                    if (typeof onCustomRateInput === 'function') onCustomRateInput();
                } else {
                    saveStateData();
                    if (state.step <= 2 && typeof calculateBoundary === 'function') calculateBoundary();
                    if (id.startsWith('compound-')) {
                        if (typeof updateCompoundSettings === 'function') updateCompoundSettings();
                    } else {
                        if (typeof draw2D === 'function') draw2D();
                        if (typeof updateCostEstimator === 'function') updateCostEstimator();
                    }
                    const elevCont = document.getElementById('elevation-container');
                    if (elevCont && elevCont.style.display !== 'none' && typeof renderActiveElevation === 'function') {
                        renderActiveElevation();
                    }
                }
            });
        }
    });

    try { if (typeof calculateBoundary === 'function') calculateBoundary(); } catch (e) { console.error('Error calculating boundary:', e); }
    try { if (typeof resizeCanvas === 'function') resizeCanvas(); } catch (e) { console.error('Error resizing canvas:', e); }
    try { if (typeof initElevationView === 'function') initElevationView(); } catch (e) { console.error('Error initializing elevation view:', e); }
    try { if (typeof init3D === 'function') init3D(); } catch (e) { console.error('Error initializing 3D view:', e); }
    try { renderFloorButtons(); } catch (e) { console.error('Error rendering floor buttons:', e); }
    try { if (typeof renderChajjaList === 'function') renderChajjaList(); } catch (e) { console.error('Error rendering chajjas:', e); }
    try { updateUI(); } catch (e) { console.error('Error updating UI:', e); }
    try { if (typeof updateCostEstimator === 'function') updateCostEstimator(); } catch (e) { console.error('Error updating cost estimator:', e); }
};

// Global Exports
window.totalSteps = totalSteps;
window.updateUI = updateUI;
window.saveStateData = saveStateData;
window.nextStep = nextStep;
window.prevStep = prevStep;
window.goToStep = goToStep;
window.renderFloorButtons = renderFloorButtons;
window.switchFloor = switchFloor;
window.addNewFloor = addNewFloor;
window.removeCurrentFloor = removeCurrentFloor;
window.setDrawMode = setDrawMode;
