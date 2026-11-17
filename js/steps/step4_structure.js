/**
 * ============================================================================
 * step4_structure.js - Step 4: Staircases, Kitchen Slabs, Pillars & Chajjas
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Architectural Staircase Controller (11 ft Height, 19-21 Steps)
// ----------------------------------------------------------------------------
function selectStairLayout(layout) {
    if (!state.stairSettings) state.stairSettings = {};
    state.stairSettings.layout = layout;

    const layouts = ['u_shape', 'l_shape', 'straight'];
    layouts.forEach(l => {
        const b = document.getElementById(`stair-layout-${l}`);
        if (b) {
            if (l === layout) {
                b.className = "stair-layout-btn py-2 px-1 text-center rounded-lg border-2 border-amber-500 bg-white text-amber-900 shadow-xs text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer";
                const icon = b.querySelector('i');
                if (icon) icon.className = icon.className.replace('text-gray-500', 'text-amber-600');
            } else {
                b.className = "stair-layout-btn py-2 px-1 text-center rounded-lg border border-gray-200 bg-white/70 text-gray-600 hover:bg-white shadow-xs text-xs font-medium transition flex flex-col items-center gap-1 cursor-pointer";
                const icon = b.querySelector('i');
                if (icon) icon.className = icon.className.replace('text-amber-600', 'text-gray-500');
            }
        }
    });

    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
        if (typeof saveHistory === 'function') saveHistory();
        const stair = state.selectedObj.item;
        stair.layout = layout;
        const ppf = state.pixelsPerFoot || 15;
        const temp = createStaircaseAsset(stair.x, stair.y, layout, {
            numSteps: stair.numSteps,
            flightWidthFt: stair.flightWidthFt,
            autoCutout: stair.autoCutout,
            rotation: stair.rotation,
            flip: stair.flip
        });
        stair.widthFt = temp.widthFt;
        stair.lengthFt = temp.lengthFt;
        stair.x1 = temp.x1;
        stair.y1 = temp.y1;
        stair.x2 = temp.x2;
        stair.y2 = temp.y2;
        if (typeof draw2D === 'function') draw2D();
        if (typeof generate3D === 'function') generate3D();
    }
}

function setStairSteps(num) {
    const n = parseInt(num) || 20;
    if (!state.stairSettings) state.stairSettings = {};
    state.stairSettings.numSteps = n;

    [19, 20, 21].forEach(val => {
        const b = document.getElementById(`stair-step-${val}`);
        if (b) {
            if (val === n) {
                b.className = "stair-step-btn py-1 px-1 text-center rounded border-2 border-amber-600 bg-amber-100 text-xs text-amber-900 font-bold cursor-pointer";
            } else {
                b.className = "stair-step-btn py-1 px-1 text-center rounded border border-gray-200 bg-white text-xs text-gray-700 font-medium hover:bg-amber-50 cursor-pointer";
            }
        }
    });

    const badge = document.getElementById('stair-calc-badge');
    if (badge) {
        if (n === 19) badge.innerText = 'Riser: 6.95" | Tread: 10.0"';
        else if (n === 20) badge.innerText = 'Riser: 6.60" | Tread: 10.5"';
        else if (n === 21) badge.innerText = 'Riser: 6.28" | Tread: 11.0"';
    }

    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
        if (typeof saveHistory === 'function') saveHistory();
        const stair = state.selectedObj.item;
        stair.numSteps = n;
        const temp = createStaircaseAsset(stair.x, stair.y, stair.layout || 'u_shape', {
            numSteps: n,
            flightWidthFt: stair.flightWidthFt,
            autoCutout: stair.autoCutout,
            rotation: stair.rotation,
            flip: stair.flip
        });
        stair.widthFt = temp.widthFt;
        stair.lengthFt = temp.lengthFt;
        stair.x1 = temp.x1;
        stair.y1 = temp.y1;
        stair.x2 = temp.x2;
        stair.y2 = temp.y2;
        if (typeof draw2D === 'function') draw2D();
        if (typeof generate3D === 'function') generate3D();
    }
}

function changeStairFlightWidth(val) {
    const fw = parseFloat(val) || 3.0;
    if (!state.stairSettings) state.stairSettings = {};
    state.stairSettings.flightWidthFt = fw;

    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
        if (typeof saveHistory === 'function') saveHistory();
        const stair = state.selectedObj.item;
        stair.flightWidthFt = fw;
        const temp = createStaircaseAsset(stair.x, stair.y, stair.layout || 'u_shape', {
            numSteps: stair.numSteps,
            flightWidthFt: fw,
            autoCutout: stair.autoCutout,
            rotation: stair.rotation,
            flip: stair.flip
        });
        stair.widthFt = temp.widthFt;
        stair.lengthFt = temp.lengthFt;
        stair.x1 = temp.x1;
        stair.y1 = temp.y1;
        stair.x2 = temp.x2;
        stair.y2 = temp.y2;
        if (typeof draw2D === 'function') draw2D();
        if (typeof generate3D === 'function') generate3D();
    }
}

function toggleStairAutoCutout(enabled) {
    if (!state.stairSettings) state.stairSettings = {};
    if (enabled === undefined) {
        state.stairSettings.autoCutout = !state.stairSettings.autoCutout;
    } else {
        state.stairSettings.autoCutout = !!enabled;
    }

    const isCutout = state.stairSettings.autoCutout;
    const chk = document.getElementById('stair-auto-cutout');
    if (chk) chk.checked = isCutout;

    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
        if (typeof saveHistory === 'function') saveHistory();
        state.selectedObj.item.autoCutout = isCutout;
    }

    const editVoidBtn = document.getElementById('btn-edit-stair-void');
    if (editVoidBtn) editVoidBtn.innerText = isCutout ? 'Void: ON' : 'Void: OFF';

    const gVoidText = document.getElementById('g-stair-void-text');
    if (gVoidText) gVoidText.innerText = isCutout ? 'Void: ON' : 'Void: OFF';

    if (typeof draw2D === 'function') draw2D();
    if (typeof generate3D === 'function') generate3D();
}

function toggleSelectedStairVoid() {
    let currentVal = true;
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
        currentVal = state.selectedObj.item.autoCutout !== false;
    } else if (typeof selected3DItem !== 'undefined' && selected3DItem && selected3DItem.type === 'asset_stair') {
        currentVal = selected3DItem.autoCutout !== false;
    }
    toggleStairAutoCutout(!currentVal);
}

function rotateCurrentStair(deg = 90) {
    let targetStair = null;
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
        targetStair = state.selectedObj.item;
    } else if (typeof selected3DItem !== 'undefined' && selected3DItem && selected3DItem.type === 'asset_stair') {
        targetStair = selected3DItem;
    }

    if (targetStair) {
        if (typeof saveHistory === 'function') saveHistory();
        targetStair.rotation = ((targetStair.rotation || 0) + deg) % 360;
        if (targetStair.x !== undefined && targetStair.y !== undefined) {
            const ppf = state.pixelsPerFoot || 15;
            const halfW = (targetStair.widthFt * ppf) / 2;
            const halfL = (targetStair.lengthFt * ppf) / 2;
            targetStair.x1 = Math.round(targetStair.x - halfW);
            targetStair.y1 = Math.round(targetStair.y - halfL);
            targetStair.x2 = Math.round(targetStair.x + halfW);
            targetStair.y2 = Math.round(targetStair.y + halfL);
        }
    } else if (state.stairSettings) {
        state.stairSettings.rotation = ((state.stairSettings.rotation || 0) + deg) % 360;
    }

    if (typeof draw2D === 'function') draw2D();
    if (typeof generate3D === 'function') generate3D();
}

function flipCurrentStair() {
    let targetStair = null;
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
        targetStair = state.selectedObj.item;
    } else if (typeof selected3DItem !== 'undefined' && selected3DItem && selected3DItem.type === 'asset_stair') {
        targetStair = selected3DItem;
    }

    if (targetStair) {
        if (typeof saveHistory === 'function') saveHistory();
        targetStair.flip = !targetStair.flip;
    } else if (state.stairSettings) {
        state.stairSettings.flip = !state.stairSettings.flip;
    }

    if (typeof draw2D === 'function') draw2D();
    if (typeof generate3D === 'function') generate3D();
}

// ----------------------------------------------------------------------------
// Structural Pillar / Column System Controls
// ----------------------------------------------------------------------------
function selectPillarShape(shape = 'quad') {
    if (!state.pillarSettings) state.pillarSettings = {};
    state.pillarSettings.shape = shape;

    const btnQuad = document.getElementById('pillar-shape-quad');
    const btnCircle = document.getElementById('pillar-shape-circle');
    const quadControls = document.getElementById('pillar-quad-controls');
    const circleControls = document.getElementById('pillar-circle-controls');

    if (btnQuad && btnCircle) {
        if (shape === 'quad') {
            btnQuad.className = "pillar-shape-btn py-2 px-1 text-center rounded-lg border-2 border-indigo-600 bg-white text-indigo-900 shadow-xs text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer";
            btnCircle.className = "pillar-shape-btn py-2 px-1 text-center rounded-lg border border-gray-200 bg-white/70 text-gray-600 hover:bg-white shadow-xs text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer";
        } else {
            btnCircle.className = "pillar-shape-btn py-2 px-1 text-center rounded-lg border-2 border-indigo-600 bg-white text-indigo-900 shadow-xs text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer";
            btnQuad.className = "pillar-shape-btn py-2 px-1 text-center rounded-lg border border-gray-200 bg-white/70 text-gray-600 hover:bg-white shadow-xs text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer";
        }
    }

    if (quadControls) quadControls.classList.toggle('hidden', shape !== 'quad');
    if (circleControls) circleControls.classList.toggle('hidden', shape !== 'circle');

    let target = null;
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_pillar') {
        target = state.selectedObj.item;
    } else if (typeof selected3DItem !== 'undefined' && selected3DItem && selected3DItem.type === 'asset_pillar') {
        target = selected3DItem;
    }

    if (target) {
        if (typeof saveHistory === 'function') saveHistory();
        target.subType = shape;
        if (shape === 'quad') {
            target.w = state.pillarSettings.w || 1.0;
            target.d = state.pillarSettings.d || 2.0;
        } else {
            target.diameter = state.pillarSettings.diameter || 1.5;
            target.radius = parseFloat((target.diameter / 2).toFixed(3));
        }
        if (typeof draw2D === 'function') draw2D();
        if (typeof generate3D === 'function') generate3D();
    }
}

function changePillarDimensions(val = '1x2') {
    if (!state.pillarSettings) state.pillarSettings = {};
    const parts = val.split('x').map(parseFloat);
    const w = parts[0] || 1.0;
    const d = parts[1] || 2.0;
    state.pillarSettings.w = w;
    state.pillarSettings.d = d;

    let target = null;
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_pillar') {
        target = state.selectedObj.item;
    } else if (typeof selected3DItem !== 'undefined' && selected3DItem && selected3DItem.type === 'asset_pillar') {
        target = selected3DItem;
    }

    if (target && target.subType === 'quad') {
        if (typeof saveHistory === 'function') saveHistory();
        target.w = w;
        target.d = d;
        if (typeof draw2D === 'function') draw2D();
        if (typeof generate3D === 'function') generate3D();
    }
}

function changePillarDiameter(dia = 1.5) {
    const numDia = parseFloat(dia) || 1.5;
    if (!state.pillarSettings) state.pillarSettings = {};
    state.pillarSettings.diameter = numDia;
    state.pillarSettings.radius = parseFloat((numDia / 2).toFixed(3));

    // Update diameter button styling
    [1.0, 1.5, 2.0].forEach(v => {
        const idStr = 'pillar-dia-' + String(v).replace('.', '_');
        const b = document.getElementById(idStr);
        if (b) {
            if (Math.abs(v - numDia) < 0.1) {
                b.className = "pillar-dia-btn py-1 px-1 text-center rounded border-2 border-indigo-600 bg-indigo-100 text-xs text-indigo-900 font-bold cursor-pointer";
            } else {
                b.className = "pillar-dia-btn py-1 px-1 text-center rounded border border-gray-200 bg-white text-xs text-gray-700 font-medium hover:bg-indigo-50 cursor-pointer";
            }
        }
    });

    let target = null;
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_pillar') {
        target = state.selectedObj.item;
    } else if (typeof selected3DItem !== 'undefined' && selected3DItem && selected3DItem.type === 'asset_pillar') {
        target = selected3DItem;
    }

    if (target && target.subType === 'circle') {
        if (typeof saveHistory === 'function') saveHistory();
        target.diameter = numDia;
        target.radius = parseFloat((numDia / 2).toFixed(3));
        if (typeof draw2D === 'function') draw2D();
        if (typeof generate3D === 'function') generate3D();
    }
}

function rotateCurrentPillar(deg = 90) {
    let target = null;
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_pillar') {
        target = state.selectedObj.item;
    } else if (typeof selected3DItem !== 'undefined' && selected3DItem && selected3DItem.type === 'asset_pillar') {
        target = selected3DItem;
    }

    if (target) {
        if (typeof saveHistory === 'function') saveHistory();
        target.rotation = ((target.rotation || 0) + deg) % 360;
    } else if (state.pillarSettings) {
        state.pillarSettings.rotation = ((state.pillarSettings.rotation || 0) + deg) % 360;
    }

    if (typeof draw2D === 'function') draw2D();
    if (typeof generate3D === 'function') generate3D();
}

// ----------------------------------------------------------------------------
// Exterior Chajja / Overhang Controller
// ----------------------------------------------------------------------------
let selectedChajjaSide = 'front';

function selectChajjaSide(side) {
    selectedChajjaSide = side;
    ['front', 'back', 'left', 'right'].forEach(s => {
        const btn = document.getElementById(`chajja-side-${s}`);
        if (btn) {
            if (s === side) {
                btn.className = "chajja-side-btn py-1.5 px-1 text-xs font-bold rounded border border-blue-600 bg-blue-50 text-blue-700 text-center transition cursor-pointer";
            } else {
                btn.className = "chajja-side-btn py-1.5 px-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 text-center transition hover:bg-gray-50 cursor-pointer";
            }
        }
    });
}

function addCurrentChajja() {
    const depthInput = document.getElementById('chajja-depth');
    const levelSelect = document.getElementById('chajja-level');
    const depth = depthInput ? (parseFloat(depthInput.value) || 3) : 3;
    const level = levelSelect ? levelSelect.value : 'roof';

    if (!state.chajjas) state.chajjas = [];

    const existingIdx = state.chajjas.findIndex(c => c.side === selectedChajjaSide && c.level === level);
    if (existingIdx >= 0) {
        state.chajjas[existingIdx].depth = depth;
    } else {
        state.chajjas.push({
            id: 'chajja_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            side: selectedChajjaSide,
            depth: depth,
            level: level
        });
    }

    if (typeof saveHistory === 'function') saveHistory();
    renderChajjaList();
    if (typeof draw2D === 'function') draw2D();
    if (state.step === 6 && typeof generate3D === 'function') generate3D();
}

function removeChajja(id) {
    if (!state.chajjas) return;
    state.chajjas = state.chajjas.filter(c => c.id !== id);
    if (typeof saveHistory === 'function') saveHistory();
    renderChajjaList();
    if (typeof draw2D === 'function') draw2D();
    if (state.step === 6 && typeof generate3D === 'function') generate3D();
}

function renderChajjaList() {
    const container = document.getElementById('chajjas-list-container');
    if (!container) return;
    const list = state.chajjas || [];
    if (list.length === 0) {
        container.innerHTML = '<div class="text-[11px] text-gray-400 italic text-center py-1.5 bg-gray-50 rounded border border-dashed border-gray-200">No chajjas on this floor yet.</div>';
        return;
    }

    container.innerHTML = list.map(c => {
        const sideCapital = c.side.charAt(0).toUpperCase() + c.side.slice(1);
        const levelLabel = c.level === 'roof' ? 'Roof Level' : 'Lintel Level';
        const levelBadgeClass = c.level === 'roof' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';
        return `
            <div class="flex items-center justify-between bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg text-xs shadow-xs">
                <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full ${c.level === 'roof' ? 'bg-blue-600' : 'bg-amber-500'}"></span>
                    <span class="font-bold text-gray-700">${sideCapital} Side</span>
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${levelBadgeClass}">${c.depth} ft • ${levelLabel}</span>
                </div>
                <button type="button" onclick="removeChajja('${c.id}')" title="Delete Chajja" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        `;
    }).join('');
}

// Global Exports
window.selectStairLayout = selectStairLayout;
window.setStairSteps = setStairSteps;
window.changeStairFlightWidth = changeStairFlightWidth;
window.toggleStairAutoCutout = toggleStairAutoCutout;
window.toggleSelectedStairVoid = toggleSelectedStairVoid;
window.rotateCurrentStair = rotateCurrentStair;
window.flipCurrentStair = flipCurrentStair;
window.selectPillarShape = selectPillarShape;
window.changePillarDimensions = changePillarDimensions;
window.changePillarDiameter = changePillarDiameter;
window.rotateCurrentPillar = rotateCurrentPillar;
window.selectChajjaSide = selectChajjaSide;
window.addCurrentChajja = addCurrentChajja;
window.removeChajja = removeChajja;
window.renderChajjaList = renderChajjaList;
