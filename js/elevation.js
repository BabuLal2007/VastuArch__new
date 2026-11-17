/**
 * ============================================================================
 * elevation.js - Architectural 2D Elevation & Cross-Section View Generator
 * ============================================================================
 */

const elevationState = {
    tab: 'front', // 'front' | 'back' | 'left' | 'right' | 'section'
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    startX: 0,
    startY: 0
};

/**
 * Initializes the elevation view canvas and binds mouse pan/zoom listeners.
 */
function initElevationView() {
    const canvas = document.getElementById('elevation-canvas');
    const wrapper = document.getElementById('elevation-canvas-wrapper');
    if (!canvas || !wrapper) return;

    // Mouse drag-pan
    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Left click only
        elevationState.isPanning = true;
        elevationState.startX = e.clientX - elevationState.panX;
        elevationState.startY = e.clientY - elevationState.panY;
        wrapper.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!elevationState.isPanning) return;
        elevationState.panX = e.clientX - elevationState.startX;
        elevationState.panY = e.clientY - elevationState.startY;
        renderActiveElevation();
    });

    window.addEventListener('mouseup', () => {
        if (elevationState.isPanning) {
            elevationState.isPanning = false;
            wrapper.style.cursor = 'grab';
        }
    });

    // Mouse wheel zoom
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.min(3.5, Math.max(0.4, elevationState.zoom * zoomFactor));

        // Zoom relative to center
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        elevationState.panX = mouseX - (mouseX - elevationState.panX) * (newZoom / elevationState.zoom);
        elevationState.panY = mouseY - (mouseY - elevationState.panY) * (newZoom / elevationState.zoom);
        elevationState.zoom = newZoom;

        renderActiveElevation();
    }, { passive: false });

    window.addEventListener('resize', () => {
        const elevCont = document.getElementById('elevation-container');
        if (elevCont && elevCont.style.display !== 'none') {
            renderActiveElevation();
        }
    });
}

/**
 * Resets pan and zoom to default auto-fit view.
 */
function resetElevationView() {
    elevationState.panX = 0;
    elevationState.panY = 0;
    elevationState.zoom = 1.0;
    renderActiveElevation();
}

/**
 * Switches the active elevation sub-tab: 'front', 'back', 'left', 'right', 'section'.
 */
function switchElevationTab(tab) {
    elevationState.tab = tab;

    // Update sub-tab styling
    ['front', 'back', 'left', 'right', 'section'].forEach(t => {
        const btn = document.getElementById(`elev-tab-${t}`);
        if (btn) {
            if (t === tab) {
                btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg transition-all bg-indigo-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer";
            } else if (t === 'section') {
                btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-purple-700 hover:text-purple-900 hover:bg-purple-50 flex items-center gap-1.5 cursor-pointer";
            } else {
                btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-gray-600 hover:text-gray-900 hover:bg-white/60 flex items-center gap-1.5 cursor-pointer";
            }
        }
    });

    renderActiveElevation();
}

/**
 * Primary rendering pipeline for the active 2D architectural elevation or cross-section.
 */
function renderActiveElevation(targetCtx = null, targetWidth = null, targetHeight = null) {
    const canvas = document.getElementById('elevation-canvas');
    const wrapper = document.getElementById('elevation-canvas-wrapper');
    if (!canvas && !targetCtx) return;

    let ctx = targetCtx;
    let cw = targetWidth;
    let ch = targetHeight;

    if (!targetCtx) {
        if (!wrapper) return;
        cw = wrapper.clientWidth || 1000;
        ch = wrapper.clientHeight || 700;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }

    // Clean background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    // Architectural subtle blueprint grid
    ctx.save();
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const gridStep = 25;
    for (let x = 0; x < cw; x += gridStep) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
    }
    for (let y = 0; y < ch; y += gridStep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }
    ctx.restore();

    // Dimensional Parameters
    const wFt = state.dimensions ? (state.dimensions.w || 30) : 30;
    const lFt = state.dimensions ? (state.dimensions.l || 50) : 50;
    const numFloors = Math.max(1, state.floors ? state.floors.length : 1);

    const plinthFt = 1.5;
    const floorHtFt = 11.0;
    const slabThickFt = 0.75; // 9-inch solid concrete slab
    const parapetFt = 3.0;

    const isSideView = (elevationState.tab === 'left' || elevationState.tab === 'right');
    const facadeWidthFt = isSideView ? lFt : wFt;
    const totalHeightFt = plinthFt + (numFloors * floorHtFt) + parapetFt;

    // View Transformation & Scale
    let scaleBase = Math.min((cw * 0.44) / facadeWidthFt, (ch * 0.54) / totalHeightFt);
    let scale = scaleBase * (targetCtx ? 1.0 : elevationState.zoom);

    let cx = targetCtx ? (cw * 0.40) : (cw * 0.40 + elevationState.panX);
    let gy = targetCtx ? (ch * 0.74) : (ch * 0.74 + elevationState.panY);

    const bLeftX = cx - (facadeWidthFt / 2) * scale;
    const bRightX = cx + (facadeWidthFt / 2) * scale;
    const plinthY = gy - (plinthFt * scale);

    // 1. Ground Baseline & Soil Earth Hatching
    drawGroundAndEarth(ctx, gy, cw, scale);

    // 2. Plinth Foundation Beam (Stone Base)
    drawPlinthFoundation(ctx, bLeftX, bRightX, plinthY, gy, scale);

    // 3. Render Elevation Facade OR Cross-Section A-A
    if (elevationState.tab === 'section') {
        drawCrossSectionView(ctx, bLeftX, bRightX, plinthY, gy, facadeWidthFt, numFloors, floorHtFt, slabThickFt, parapetFt, scale);
    } else {
        drawFacadeElevation(ctx, bLeftX, bRightX, plinthY, facadeWidthFt, numFloors, floorHtFt, slabThickFt, parapetFt, scale, elevationState.tab);
    }

    // 4. Vertical Dimension Strings & Level Datum Flags
    drawDimensionsAndDatums(ctx, bLeftX, bRightX, gy, plinthY, numFloors, floorHtFt, slabThickFt, parapetFt, totalHeightFt, scale);

    // 5. Formal Architectural Title Block
    drawTitleBlock(ctx, cw, ch, elevationState.tab, wFt, lFt, numFloors, totalHeightFt);
}

/**
 * Draws the ground level baseline and geological soil earth hatch.
 */
function drawGroundAndEarth(ctx, gy, cw, scale) {
    ctx.save();
    // Heavy Natural Ground Line
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(cw, gy);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Standard CAD Earth Hatch (Groups of 3 diagonal lines with dots)
    const hatchH = 35;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    for (let x = 10; x < cw - 20; x += 30) {
        for (let i = 0; i < 3; i++) {
            const hx = x + i * 5;
            ctx.beginPath();
            ctx.moveTo(hx, gy + 3);
            ctx.lineTo(hx + 12, gy + hatchH);
            ctx.stroke();
        }
        // Soil compact dots
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(x + 18, gy + 15, 1.2, 0, Math.PI * 2);
        ctx.arc(x + 8, gy + 26, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/**
 * Draws the elevated plinth foundation with chamfered ashlar stone texture.
 */
function drawPlinthFoundation(ctx, bLeftX, bRightX, plinthY, gy, scale) {
    ctx.save();
    const plinthOffset = 0.3 * scale;
    const px1 = bLeftX - plinthOffset;
    const px2 = bRightX + plinthOffset;
    const ph = gy - plinthY;

    // Plinth stone block fill
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px1, plinthY, px2 - px1, ph);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(px1, plinthY, px2 - px1, ph);

    // Horizontal plinth drip moulding groove
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px1, plinthY + ph * 0.5);
    ctx.lineTo(px2, plinthY + ph * 0.5);
    ctx.stroke();

    // Chamfered stone blocks
    const blockStep = 4 * scale;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    for (let bx = px1 + blockStep; bx < px2; bx += blockStep) {
        ctx.beginPath();
        ctx.moveTo(bx, plinthY);
        ctx.lineTo(bx, gy);
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Draws the external architectural facade for Front, Back, Left, or Right elevations.
 */
function drawFacadeElevation(ctx, bLeftX, bRightX, plinthY, facadeWidthFt, numFloors, floorHtFt, slabThickFt, parapetFt, scale, side) {
    const widthPx = bRightX - bLeftX;

    for (let f = 0; f < numFloors; f++) {
        const floorBaseY = plinthY - (f * floorHtFt) * scale;
        const floorCeilY = floorBaseY - (floorHtFt * scale);
        const floorObj = (state.floors && state.floors[f]) ? state.floors[f] : null;

        // 1. Main Facade Wall Body
        ctx.save();
        let wallFill = '#fafaf9'; // Warm architectural ivory stucco
        const wallMatId = (floorObj && floorObj.floorMaterial) || state.floorMaterial;
        if (wallMatId && typeof MATERIAL_CATALOG !== 'undefined' && MATERIAL_CATALOG[wallMatId]) {
            wallFill = MATERIAL_CATALOG[wallMatId].colorHex || '#fafaf9';
        }

        ctx.fillStyle = wallFill;
        ctx.fillRect(bLeftX, floorCeilY, widthPx, (floorHtFt * scale));

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(bLeftX, floorCeilY, widthPx, (floorHtFt * scale));

        // Subtle horizontal ashlar groove lines
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
        ctx.lineWidth = 0.8;
        const grooveStep = 2.5 * scale;
        for (let gy = floorCeilY + grooveStep; gy < floorBaseY; gy += grooveStep) {
            ctx.beginPath();
            ctx.moveTo(bLeftX, gy);
            ctx.lineTo(bRightX, gy);
            ctx.stroke();
        }
        ctx.restore();

        // 2. Windows, Doors & Balconies
        drawFacadeOpenings(ctx, bLeftX, bRightX, floorBaseY, floorObj, f, scale, side, facadeWidthFt);

        // 3. Exterior Chajjas / Cantilever Overhangs on this floor
        if (floorObj && floorObj.chajjas && floorObj.chajjas.length > 0) {
            floorObj.chajjas.forEach(ch => {
                if (ch.side === side || (!ch.side && side === 'front')) {
                    const extPx = (ch.depth || 3.0) * scale;
                    const chH = 0.3 * scale;
                    const chY = (ch.level === 'roof') ? floorCeilY : (floorBaseY - 7.0 * scale);

                    ctx.save();
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(bLeftX - extPx * 0.3, chY - chH, widthPx + extPx * 0.6, chH);
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(bLeftX - extPx * 0.3, chY - chH, widthPx + extPx * 0.6, chH);

                    // Drip fascia lip
                    ctx.fillStyle = '#64748b';
                    ctx.fillRect(bLeftX - extPx * 0.3, chY - 0.08 * scale, widthPx + extPx * 0.6, 0.08 * scale);
                    ctx.restore();
                }
            });
        }

        // 4. Floor Intermediate Slabs (9 Inches Concrete Band)
        if (f > 0) {
            const slabY = floorBaseY;
            const slabH = slabThickFt * scale;
            ctx.save();
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(bLeftX - 0.15 * scale, slabY - slabH, widthPx + 0.3 * scale, slabH);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.strokeRect(bLeftX - 0.15 * scale, slabY - slabH, widthPx + 0.3 * scale, slabH);
            ctx.restore();
        }
    }

    // 5. Top Roof Slab (9 Inches)
    const roofSlabY = plinthY - (numFloors * floorHtFt) * scale;
    const roofSlabH = slabThickFt * scale;
    ctx.save();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bLeftX - 0.35 * scale, roofSlabY - roofSlabH, widthPx + 0.7 * scale, roofSlabH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bLeftX - 0.35 * scale, roofSlabY - roofSlabH, widthPx + 0.7 * scale, roofSlabH);
    ctx.restore();

    // 6. Parapet / Barandi Terrace Wall (3.0 ft)
    const parapetY = roofSlabY - roofSlabH - (parapetFt * scale);
    ctx.save();
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(bLeftX, parapetY, widthPx, (parapetFt * scale));
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(bLeftX, parapetY, widthPx, (parapetFt * scale));

    // Stone Coping Cap atop Parapet
    const capH = 0.22 * scale;
    ctx.fillStyle = '#475569';
    ctx.fillRect(bLeftX - 0.15 * scale, parapetY - capH, widthPx + 0.3 * scale, capH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bLeftX - 0.15 * scale, parapetY - capH, widthPx + 0.3 * scale, capH);

    // Decorative balustrade inserts or drainage scuppers
    const scupperStep = 6 * scale;
    for (let sx = bLeftX + scupperStep; sx < bRightX - scupperStep * 0.5; sx += scupperStep) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx, parapetY + (parapetFt * scale) - 0.4 * scale, 0.4 * scale, 0.2 * scale);
    }
    ctx.restore();

    // 7. Staircase Mumty / Headroom Tower (if stairs exist)
    const hasStairs = (state.floors || []).some(fl => (fl.assets || []).some(a => a.type === 'asset_stair'));
    if (hasStairs) {
        const mumtyW = 10 * scale;
        const mumtyH = 8.5 * scale;
        const mumtyX = bLeftX + widthPx * 0.15;
        const mumtyY = parapetY - (mumtyH - parapetFt * scale);

        ctx.save();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(mumtyX, mumtyY, mumtyW, mumtyH);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(mumtyX, mumtyY, mumtyW, mumtyH);

        // Mumty top slab & coping
        ctx.fillStyle = '#475569';
        ctx.fillRect(mumtyX - 0.2 * scale, mumtyY - 0.2 * scale, mumtyW + 0.4 * scale, 0.2 * scale);

        // Mumty Terrace Door
        const mDoorW = 3.0 * scale;
        const mDoorH = 6.8 * scale;
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(mumtyX + mumtyW * 0.2, mumtyY + mumtyH - mDoorH, mDoorW, mDoorH);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(mumtyX + mumtyW * 0.2, mumtyY + mumtyH - mDoorH, mDoorW, mDoorH);
        ctx.restore();
    }

    // 8. Overhead Water Tank (if placed)
    const hasTank = (state.floors || []).some(fl => (fl.mepAssets || []).some(m => m.type === 'mep_overhead_tank'));
    if (hasTank) {
        const tankX = bRightX - widthPx * 0.25;
        const tankBaseY = parapetY - capH;
        const legH = 1.5 * scale;
        const tankR = 1.6 * scale;
        const tankH = 3.5 * scale;

        ctx.save();
        // Steel dunnage legs
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tankX - tankR * 0.7, tankBaseY); ctx.lineTo(tankX - tankR * 0.7, tankBaseY - legH);
        ctx.moveTo(tankX + tankR * 0.7, tankBaseY); ctx.lineTo(tankX + tankR * 0.7, tankBaseY - legH);
        ctx.moveTo(tankX - tankR * 0.7, tankBaseY); ctx.lineTo(tankX + tankR * 0.7, tankBaseY - legH);
        ctx.stroke();

        // Sintex blue tank body
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(tankX - tankR, tankBaseY - legH - tankH, tankR * 2, tankH);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tankX - tankR, tankBaseY - legH - tankH, tankR * 2, tankH);

        // Rib rings
        for (let r = 1; r < 4; r++) {
            const ry = tankBaseY - legH - (r * tankH / 4);
            ctx.beginPath(); ctx.moveTo(tankX - tankR, ry); ctx.lineTo(tankX + tankR, ry); ctx.stroke();
        }

        // Conical lid
        ctx.beginPath();
        ctx.moveTo(tankX - tankR, tankBaseY - legH - tankH);
        ctx.lineTo(tankX, tankBaseY - legH - tankH - 0.6 * scale);
        ctx.lineTo(tankX + tankR, tankBaseY - legH - tankH);
        ctx.closePath();
        ctx.fillStyle = '#1e3a8a';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    // 9. Foreground Compound Wall & Main Gate (on Front Elevation)
    if (side === 'front' && state.compound && state.compound.enabled) {
        drawForegroundCompoundWall(ctx, bLeftX, bRightX, plinthY, scale);
    }
}

/**
 * Draws architectural windows, doors, and balcony railings on the elevation facade.
 */
function drawFacadeOpenings(ctx, bLeftX, bRightX, floorBaseY, floorObj, floorIdx, scale, side, facadeWidthFt) {
    const widthPx = bRightX - bLeftX;
    const sillH = 3.0 * scale;
    const lintelH = 7.0 * scale;
    const winH = 4.0 * scale;
    const winY = floorBaseY - lintelH;

    // Filter openings facing this facade
    const isFront = (side === 'front');
    const isDoorEntranceFloor = (floorIdx === 0 && isFront);

    // Default facade rhythm if no manual openings are assigned
    const numBays = Math.max(2, Math.round(facadeWidthFt / 10));
    const baySpacing = widthPx / (numBays + 1);

    for (let b = 1; b <= numBays; b++) {
        const bayCenterX = bLeftX + b * baySpacing;

        // If Ground floor front entrance bay -> Draw Main Door
        if (isDoorEntranceFloor && b === Math.ceil(numBays / 2)) {
            const doorW = 4.5 * scale;
            const doorH = 7.0 * scale;
            const dx = bayCenterX - doorW / 2;
            const dy = floorBaseY - doorH;

            ctx.save();
            // Outer Frame
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(dx, dy, doorW, doorH);

            // Double Door Leaf Paneling
            const leafW = (doorW - 0.2 * scale) / 2;
            [-1, 1].forEach((dir, lIdx) => {
                const lx = dx + 0.08 * scale + lIdx * (leafW + 0.04 * scale);
                ctx.fillStyle = '#92400e'; // Rich warm teak wood
                ctx.fillRect(lx, dy + 0.08 * scale, leafW, doorH - 0.08 * scale);
                ctx.strokeStyle = '#451a03';
                ctx.lineWidth = 1;
                ctx.strokeRect(lx, dy + 0.08 * scale, leafW, doorH - 0.08 * scale);

                // Inset panels
                const pBoxH = (doorH - 1.2 * scale) / 3;
                for (let k = 0; k < 3; k++) {
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(lx + 0.15 * scale, dy + 0.25 * scale + k * (pBoxH + 0.2 * scale), leafW - 0.3 * scale, pBoxH);
                }

                // Polished brass handle
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(lx + (lIdx === 0 ? leafW - 0.2 * scale : 0.2 * scale), dy + doorH * 0.55, 0.08 * scale, 0, Math.PI * 2);
                ctx.fill();
            });

            // Transom highlight stone architrave
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(dx - 0.15 * scale, dy - 0.25 * scale, doorW + 0.3 * scale, 0.25 * scale);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(dx - 0.15 * scale, dy - 0.25 * scale, doorW + 0.3 * scale, 0.25 * scale);
            ctx.restore();

        } else {
            // Draw Architectural Window
            const winW = 4.0 * scale;
            const wx = bayCenterX - winW / 2;

            ctx.save();
            // Projecting Stone Sill Ledge
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(wx - 0.25 * scale, floorBaseY - sillH, winW + 0.5 * scale, 0.22 * scale);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(wx - 0.25 * scale, floorBaseY - sillH, winW + 0.5 * scale, 0.22 * scale);

            // Window Casing Frame
            ctx.fillStyle = '#334155';
            ctx.fillRect(wx, winY, winW, winH);

            // Architectural Glass Panes (Sky reflection + Glare lines)
            const paneGap = 0.15 * scale;
            const halfW = (winW - paneGap * 3) / 2;
            const paneH = winH - paneGap * 2;

            [-1, 1].forEach((dir, pIdx) => {
                const px = wx + paneGap + pIdx * (halfW + paneGap);
                const py = winY + paneGap;

                // Glass Gradient
                const glassGrad = ctx.createLinearGradient(px, py, px, py + paneH);
                glassGrad.addColorStop(0, '#bae6fd');
                glassGrad.addColorStop(1, '#e0f2fe');
                ctx.fillStyle = glassGrad;
                ctx.fillRect(px, py, halfW, paneH);

                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(px, py, halfW, paneH);

                // Diagonal reflection glare lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(px + halfW * 0.2, py + paneH * 0.8);
                ctx.lineTo(px + halfW * 0.8, py + paneH * 0.2);
                ctx.moveTo(px + halfW * 0.35, py + paneH * 0.85);
                ctx.lineTo(px + halfW * 0.85, py + paneH * 0.35);
                ctx.stroke();
            });

            // Lintel Head Stone
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(wx - 0.2 * scale, winY - 0.22 * scale, winW + 0.4 * scale, 0.22 * scale);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(wx - 0.2 * scale, winY - 0.22 * scale, winW + 0.4 * scale, 0.22 * scale);
            ctx.restore();
        }
    }
}

/**
 * Draws the foreground compound boundary wall, gate posts with lanterns, main gate, and car ramp.
 */
function drawForegroundCompoundWall(ctx, bLeftX, bRightX, plinthY, scale) {
    const cSettings = state.compound || {};
    const cWallHFt = cSettings.heightFt || 5.0;
    const cWallHPx = cWallHFt * scale;

    const sLeftPx = (cSettings.setbacks && cSettings.setbacks.left !== undefined ? cSettings.setbacks.left : 3) * scale;
    const sRightPx = (cSettings.setbacks && cSettings.setbacks.right !== undefined ? cSettings.setbacks.right : 3) * scale;

    const cpLeftX = bLeftX - sLeftPx;
    const cpRightX = bRightX + sRightPx;
    const cpWidth = cpRightX - cpLeftX;
    const groundY = plinthY + (1.5 * scale);

    const gateWPx = Math.min(9.0 * scale, cpWidth * 0.65);
    const gateCenterX = (cpLeftX + cpRightX) / 2;
    const gp1x = gateCenterX - gateWPx / 2;
    const gp2x = gateCenterX + gateWPx / 2;

    const wallTopY = groundY - cWallHPx;

    ctx.save();
    // 1. Masonry Wall Segments (Left & Right of gate)
    ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';
    ctx.fillRect(cpLeftX, wallTopY, gp1x - cpLeftX, cWallHPx);
    ctx.fillRect(gp2x, wallTopY, cpRightX - gp2x, cWallHPx);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(cpLeftX, wallTopY, gp1x - cpLeftX, cWallHPx);
    ctx.strokeRect(gp2x, wallTopY, cpRightX - gp2x, cWallHPx);

    // Stone Coping Cap on Compound Wall
    const cCapH = 0.18 * scale;
    ctx.fillStyle = '#475569';
    ctx.fillRect(cpLeftX - 0.1 * scale, wallTopY - cCapH, (gp1x - cpLeftX) + 0.1 * scale, cCapH);
    ctx.fillRect(gp2x, wallTopY - cCapH, (cpRightX - gp2x) + 0.1 * scale, cCapH);

    // 2. Gate Posts with Lanterns
    const postWPx = 1.6 * scale;
    const postHPx = cWallHPx + 0.85 * scale;

    [gp1x, gp2x].forEach(gx => {
        const px = gx - postWPx / 2;
        const py = groundY - postHPx;

        // Pillar shaft
        ctx.fillStyle = '#334155';
        ctx.fillRect(px, py, postWPx, postHPx);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, postWPx, postHPx);

        // Stepped capital
        ctx.fillStyle = '#475569';
        ctx.fillRect(px - 0.15 * scale, py - 0.22 * scale, postWPx + 0.3 * scale, 0.22 * scale);

        // Gate Lantern Fixture (Glowing Warm Amber)
        const lBoxW = 0.55 * scale;
        const lBoxH = 0.7 * scale;
        const lx = gx - lBoxW / 2;
        const ly = py - 0.22 * scale - lBoxH;

        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(lx, ly, lBoxW, lBoxH);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(lx, ly, lBoxW, lBoxH);

        // Lantern pyramid cap
        ctx.beginPath();
        ctx.moveTo(lx - 0.05 * scale, ly);
        ctx.lineTo(gx, ly - 0.35 * scale);
        ctx.lineTo(lx + lBoxW + 0.05 * scale, ly);
        ctx.closePath();
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.stroke();
    });

    // 3. Main Gate Mesh (Sliding or Double Leaf)
    const gateStyle = cSettings.gateStyle || 'sliding';
    if (gateStyle !== 'open') {
        const gateHPx = cWallHPx * 0.92;
        const gy = groundY - gateHPx;

        ctx.fillStyle = '#1e293b'; // Dark metallic iron
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8;

        if (gateStyle === 'sliding') {
            // Horizontal louvres with gold bars
            ctx.fillRect(gp1x, gy, gateWPx, gateHPx);
            ctx.strokeRect(gp1x, gy, gateWPx, gateHPx);

            // Horizontal slats
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            const slatCount = 8;
            for (let s = 1; s < slatCount; s++) {
                const sy = gy + (s * gateHPx / slatCount);
                ctx.beginPath(); ctx.moveTo(gp1x, sy); ctx.lineTo(gp2x, sy); ctx.stroke();
            }

            // 3 Vertical Polished Gold Accents
            [-0.25, 0, 0.25].forEach(k => {
                const gx = gateCenterX + k * gateWPx;
                ctx.fillStyle = '#d97706';
                ctx.fillRect(gx - 0.08 * scale, gy + 0.1 * scale, 0.16 * scale, gateHPx - 0.2 * scale);
            });

        } else {
            // Double leaf royal gate with spearhead pickets
            const halfW = gateWPx / 2;
            ctx.strokeRect(gp1x, gy, halfW, gateHPx);
            ctx.strokeRect(gateCenterX, gy, halfW, gateHPx);

            // Vertical pickets with golden finials
            const numP = 10;
            ctx.fillStyle = '#d97706';
            for (let p = 1; p < numP; p++) {
                const px = gp1x + (p * gateWPx / numP);
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(px, groundY); ctx.lineTo(px, gy); ctx.stroke();

                // Gold spear
                ctx.beginPath();
                ctx.moveTo(px - 0.08 * scale, gy);
                ctx.lineTo(px, gy - 0.25 * scale);
                ctx.lineTo(px + 0.08 * scale, gy);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    // 4. Car Parking Ramp (Concrete Slope to Road)
    if (cSettings.addRamp !== false) {
        const rampHPx = 0.25 * scale;
        const rampWPx = gateWPx - 0.2 * scale;
        const rx = gateCenterX - rampWPx / 2;

        ctx.beginPath();
        ctx.moveTo(rx, groundY);
        ctx.lineTo(rx + rampWPx, groundY);
        ctx.lineTo(rx + rampWPx + 0.4 * scale, groundY + 0.4 * scale);
        ctx.lineTo(rx - 0.4 * scale, groundY + 0.4 * scale);
        ctx.closePath();
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = `bold ${Math.max(8, 9 * scale / 15)}px Inter, sans-serif`;
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.fillText('CAR RAMP (SLOPE)', gateCenterX, groundY + 0.3 * scale);
    }
    ctx.restore();
}

/**
 * Draws the architectural Vertical Cross-Section (Section A-A).
 */
function drawCrossSectionView(ctx, bLeftX, bRightX, plinthY, gy, facadeWidthFt, numFloors, floorHtFt, slabThickFt, parapetFt, scale) {
    const widthPx = bRightX - bLeftX;
    const wallThickPx = 0.75 * scale; // 9-inch exterior cut wall
    const partThickPx = 0.45 * scale; // 4.5-inch interior cut wall

    // 1. Concrete Strip Foundation Footings in Earth
    ctx.save();
    const footH = 2.0 * scale;
    const footWPx = 2.2 * scale;
    [bLeftX, bLeftX + widthPx * 0.5, bRightX].forEach(fx => {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(fx - footWPx / 2, gy, footWPx, footH);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(fx - footWPx / 2, gy, footWPx, footH);

        // Concrete aggregate hatch
        drawConcreteHatch(ctx, fx - footWPx / 2, gy, footWPx, footH);
    });
    ctx.restore();

    // 2. Each Floor Section (Cut Slabs, Interior Partitions, Rooms & Stairs)
    for (let f = 0; f < numFloors; f++) {
        const floorBaseY = plinthY - (f * floorHtFt) * scale;
        const floorCeilY = floorBaseY - (floorHtFt * scale);
        const slabY = floorBaseY;
        const slabH = slabThickFt * scale;
        const floorObj = (state.floors && state.floors[f]) ? state.floors[f] : null;

        // Interior Space Background
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bLeftX + wallThickPx, floorCeilY, widthPx - wallThickPx * 2, floorHtFt * scale);

        // Interior Ceiling Line
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bLeftX + wallThickPx, floorCeilY);
        ctx.lineTo(bRightX - wallThickPx, floorCeilY);
        ctx.stroke();

        // Left Cut Wall & Right Cut Wall (9-inch brick cross-hatch)
        drawSectionWall(ctx, bLeftX, floorCeilY, wallThickPx, floorHtFt * scale);
        drawSectionWall(ctx, bRightX - wallThickPx, floorCeilY, wallThickPx, floorHtFt * scale);

        // Center Interior Partition Cut Wall
        const partX = bLeftX + widthPx * 0.52 - partThickPx / 2;
        drawSectionWall(ctx, partX, floorCeilY, partThickPx, floorHtFt * scale);

        // Interior Door on rear partition
        const doorW = 3.2 * scale;
        const doorH = 7.0 * scale;
        const doorX = bLeftX + widthPx * 0.28;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(doorX, floorBaseY - doorH, doorW, doorH);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(doorX, floorBaseY - doorH, doorW, doorH);
        // Handle
        ctx.fillStyle = '#d97706';
        ctx.beginPath(); ctx.arc(doorX + doorW - 0.3 * scale, floorBaseY - 3.2 * scale, 0.08 * scale, 0, Math.PI * 2); ctx.fill();

        // Staircase Flight in Profile
        drawSectionStairs(ctx, bLeftX + widthPx * 0.6, floorBaseY, floorCeilY, scale);

        // Room Name Badges
        const leftRoomName = f === 0 ? 'LIVING / DINING' : 'MASTER BEDROOM';
        const rightRoomName = f === 0 ? 'KITCHEN' : 'GUEST BEDROOM';

        drawRoomBadge(ctx, bLeftX + widthPx * 0.26, floorBaseY - 5.5 * scale, `${leftRoomName} (11'-0" CLR)`, scale);
        drawRoomBadge(ctx, bLeftX + widthPx * 0.78, floorBaseY - 5.5 * scale, `${rightRoomName} (11'-0" CLR)`, scale);

        // Floor Solid Slab (9-inch concrete aggregate hatch)
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(bLeftX, slabY - slabH, widthPx, slabH);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(bLeftX, slabY - slabH, widthPx, slabH);
        drawConcreteHatch(ctx, bLeftX, slabY - slabH, widthPx, slabH);
        ctx.restore();
    }

    // 3. Top Roof Slab in Section
    const roofSlabY = plinthY - (numFloors * floorHtFt) * scale;
    const roofSlabH = slabThickFt * scale;
    ctx.save();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(bLeftX - 0.3 * scale, roofSlabY - roofSlabH, widthPx + 0.6 * scale, roofSlabH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bLeftX - 0.3 * scale, roofSlabY - roofSlabH, widthPx + 0.6 * scale, roofSlabH);
    drawConcreteHatch(ctx, bLeftX - 0.3 * scale, roofSlabY - roofSlabH, widthPx + 0.6 * scale, roofSlabH);

    // Parapet Wall in Section
    const parapetY = roofSlabY - roofSlabH - (parapetFt * scale);
    drawSectionWall(ctx, bLeftX, parapetY, wallThickPx, parapetFt * scale);
    drawSectionWall(ctx, bRightX - wallThickPx, parapetY, wallThickPx, parapetFt * scale);

    // Coping caps
    ctx.fillStyle = '#475569';
    ctx.fillRect(bLeftX - 0.1 * scale, parapetY - 0.2 * scale, wallThickPx + 0.2 * scale, 0.2 * scale);
    ctx.fillRect(bRightX - wallThickPx - 0.1 * scale, parapetY - 0.2 * scale, wallThickPx + 0.2 * scale, 0.2 * scale);
    ctx.restore();
}

/**
 * Draws a section-cut masonry wall with 45-degree architectural hatch lines.
 */
function drawSectionWall(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Diagonal 45-deg brick hatch
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 8;
    for (let d = -h; d < w + h; d += step) {
        const x1 = Math.max(x, x + d);
        const y1 = Math.max(y, y - d);
        const x2 = Math.min(x + w, x + d + h);
        const y2 = Math.min(y + h, y - d + h);
        if (x1 < x + w && y1 < y + h) {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
    }
    ctx.stroke();
    ctx.restore();
}

/**
 * Draws CAD concrete aggregate stipple hatch (dots + tiny triangles).
 */
function drawConcreteHatch(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.8;

    const count = Math.max(6, Math.floor((w * h) / 120));
    for (let i = 0; i < count; i++) {
        const px = x + ((i * 37) % Math.floor(w - 6)) + 3;
        const py = y + ((i * 23) % Math.floor(h - 4)) + 2;

        if (i % 3 === 0) {
            // Small concrete stone triangle
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + 2.5, py + 3);
            ctx.lineTo(px - 2.5, py + 3);
            ctx.closePath();
            ctx.stroke();
        } else {
            // Concrete sand dot
            ctx.beginPath();
            ctx.arc(px, py, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

/**
 * Draws a staircase flight cut in profile cross-section.
 */
function drawSectionStairs(ctx, startX, floorBaseY, floorCeilY, scale) {
    ctx.save();
    const totalRise = floorBaseY - floorCeilY;
    const numSteps = 10;
    const stepRise = totalRise / numSteps;
    const stepTread = 0.85 * scale;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.8;
    ctx.fillStyle = '#e2e8f0';

    ctx.beginPath();
    ctx.moveTo(startX, floorBaseY);
    for (let s = 0; s < numSteps; s++) {
        const sx = startX + s * stepTread;
        const sy = floorBaseY - s * stepRise;
        ctx.lineTo(sx, sy - stepRise);
        ctx.lineTo(sx + stepTread, sy - stepRise);
    }
    // Waist slab underside
    ctx.lineTo(startX + numSteps * stepTread, floorBaseY - totalRise + 0.4 * scale);
    ctx.lineTo(startX, floorBaseY + 0.4 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Handrail (3.0 ft high)
    const railH = 3.0 * scale;
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, floorBaseY - railH);
    ctx.lineTo(startX + numSteps * stepTread, floorBaseY - totalRise - railH);
    ctx.stroke();

    // Balusters
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    for (let b = 0; b < numSteps; b += 2) {
        const bx = startX + b * stepTread + stepTread / 2;
        const by = floorBaseY - b * stepRise - stepRise;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by - railH);
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Draws a room identification label badge inside cross-section spaces.
 */
function drawRoomBadge(ctx, x, y, text, scale) {
    ctx.save();
    ctx.font = `bold ${Math.max(9, 10 * scale / 15)}px Inter, sans-serif`;
    const tw = ctx.measureText(text).width;
    const pad = 6;

    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.fillRect(x - tw / 2 - pad, y - 9, tw + pad * 2, 18);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - tw / 2 - pad, y - 9, tw + pad * 2, 18);

    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
}

/**
 * Draws vertical dimension strings and level datum flags with architectural accuracy.
 */
function drawDimensionsAndDatums(ctx, bLeftX, bRightX, gy, plinthY, numFloors, floorHtFt, slabThickFt, parapetFt, totalHeightFt, scale) {
    ctx.save();
    const dimLeftX = bLeftX - 75;
    const tickLen = 5;

    // Helper: Draw dimension line segment with diagonal tick marks
    function drawDimSegment(y1, y2, label) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.2;

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(dimLeftX, y1);
        ctx.lineTo(dimLeftX, y2);
        ctx.stroke();

        // 45-deg slash ticks
        ctx.beginPath();
        ctx.moveTo(dimLeftX - tickLen, y1 + tickLen); ctx.lineTo(dimLeftX + tickLen, y1 - tickLen);
        ctx.moveTo(dimLeftX - tickLen, y2 + tickLen); ctx.lineTo(dimLeftX + tickLen, y2 - tickLen);
        ctx.stroke();

        // Horizontal extension lines
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(dimLeftX - 10, y1); ctx.lineTo(bLeftX - 10, y1);
        ctx.moveTo(dimLeftX - 10, y2); ctx.lineTo(bLeftX - 10, y2);
        ctx.stroke();

        // Dimension text
        ctx.font = `bold ${Math.max(8.5, 9.5 * scale / 15)}px Inter, sans-serif`;
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, dimLeftX - 8, (y1 + y2) / 2);
    }

    // 1. Plinth Dimension (1'-6")
    drawDimSegment(gy, plinthY, "PLINTH 1'-6\"");

    // 2. Each Floor Heights (Sill, Lintel, Ceiling, Slab)
    for (let f = 0; f < numFloors; f++) {
        const floorBaseY = plinthY - (f * floorHtFt) * scale;
        const sillY = floorBaseY - (3.0 * scale);
        const lintelY = floorBaseY - (7.0 * scale);
        const ceilY = floorBaseY - (floorHtFt * scale);

        drawDimSegment(floorBaseY, sillY, "SILL 3'-0\"");
        drawDimSegment(sillY, lintelY, "WIN 4'-0\"");
        drawDimSegment(lintelY, ceilY, "LINTEL 4'-0\"");

        const floorName = f === 0 ? "GROUND FLR" : `FLOOR ${f + 1}`;
        // Level extension datum on right
        drawDatumMarker(ctx, bRightX, floorBaseY, `${floorName} LVL (+${(1.5 + f * floorHtFt).toFixed(1)}')`, scale);
    }

    // 3. Roof & Parapet Dimensions
    const roofSlabY = plinthY - (numFloors * floorHtFt) * scale;
    const parapetY = roofSlabY - (parapetFt * scale);

    drawDimSegment(roofSlabY, parapetY, "PARAPET 3'-0\"");

    // 4. Datum Markers on Right Margin
    drawDatumMarker(ctx, bRightX, gy, "GROUND LEVEL (±0'-0\")", scale);
    drawDatumMarker(ctx, bRightX, plinthY, "PLINTH LEVEL (+1'-6\")", scale);
    drawDatumMarker(ctx, bRightX, roofSlabY, `ROOF SLAB (+${(1.5 + numFloors * floorHtFt).toFixed(1)}')`, scale);
    drawDatumMarker(ctx, bRightX, parapetY, `T.O. PARAPET (+${totalHeightFt.toFixed(1)}')`, scale);

    // 5. Total Building Height Dimension String (Far Left)
    const totalDimX = dimLeftX - 55;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(totalDimX, gy);
    ctx.lineTo(totalDimX, parapetY);
    ctx.stroke();

    // Arrows on total height
    drawArrowHead(ctx, totalDimX, parapetY, 'up');
    drawArrowHead(ctx, totalDimX, gy, 'down');

    // Extension lines
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#93c5fd';
    ctx.beginPath();
    ctx.moveTo(totalDimX, parapetY); ctx.lineTo(bLeftX - 10, parapetY);
    ctx.moveTo(totalDimX, gy); ctx.lineTo(bLeftX - 10, gy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Total Height Text Badge
    ctx.save();
    ctx.translate(totalDimX - 10, (gy + parapetY) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `bold ${Math.max(9, 10.5 * scale / 15)}px Inter, sans-serif`;
    ctx.fillStyle = '#1d4ed8';
    ctx.textAlign = 'center';
    ctx.fillText(`TOTAL HEIGHT: ${totalHeightFt.toFixed(1)}' (${(totalHeightFt * 0.3048).toFixed(2)} m)`, 0, 0);
    ctx.restore();

    ctx.restore();
}

/**
 * Draws an architectural Level Datum Marker with triangle flag and dashed extension line.
 */
function drawDatumMarker(ctx, bRightX, y, label, scale) {
    ctx.save();
    const datumLineEndX = bRightX + 130;

    // Dashed horizontal line extending from building
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bRightX, y);
    ctx.lineTo(datumLineEndX, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Filled inverted datum triangle ▼
    const triSize = 6;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(datumLineEndX, y);
    ctx.lineTo(datumLineEndX + triSize, y - triSize * 1.5);
    ctx.lineTo(datumLineEndX - triSize, y - triSize * 1.5);
    ctx.closePath();
    ctx.fill();

    // Horizontal baseline under triangle
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(datumLineEndX - triSize * 1.5, y);
    ctx.lineTo(datumLineEndX + triSize * 1.5, y);
    ctx.stroke();

    // Datum Label Text
    ctx.font = `bold ${Math.max(8.5, 9.5 * scale / 15)}px Inter, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, datumLineEndX + 12, y);
    ctx.restore();
}

function drawArrowHead(ctx, x, y, dir) {
    ctx.save();
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    if (dir === 'up') {
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3.5, y + 8);
        ctx.lineTo(x + 3.5, y + 8);
    } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3.5, y - 8);
        ctx.lineTo(x + 3.5, y - 8);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/**
 * Draws the formal Architectural Title Block at the bottom right corner.
 */
function drawTitleBlock(ctx, cw, ch, tab, widthFt, depthFt, numFloors, totalHeightFt) {
    const tbW = 320;
    const tbH = 175;
    const tbX = cw - tbW - 25;
    const tbY = ch - tbH - 25;

    ctx.save();
    // Background card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.fillRect(tbX, tbY, tbW, tbH);

    // Architectural Double Border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(tbX, tbY, tbW, tbH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(tbX + 3, tbY + 3, tbW - 6, tbH - 6);

    // Header Banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tbX + 4, tbY + 4, tbW - 8, 28);

    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SMART HOME DIGITAL VASTU — CAD STUDIO', tbX + tbW / 2, tbY + 18);

    // Sheet Name Display
    let sheetName = 'FRONT ELEVATION';
    if (tab === 'back') sheetName = 'REAR ELEVATION';
    else if (tab === 'left') sheetName = 'LEFT SIDE ELEVATION';
    else if (tab === 'right') sheetName = 'RIGHT SIDE ELEVATION';
    else if (tab === 'section') sheetName = 'VERTICAL CROSS-SECTION A-A';

    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillStyle = '#1e3a8a';
    ctx.textAlign = 'center';
    ctx.fillText(sheetName, tbX + tbW / 2, tbY + 47);

    // Divider line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tbX + 10, tbY + 58);
    ctx.lineTo(tbX + tbW - 10, tbY + 58);
    ctx.stroke();

    // Property Information Grid
    const sqFt = widthFt * depthFt;
    const gaj = (sqFt / 9).toFixed(1);
    const totalBuiltUpSqFt = sqFt * numFloors;
    const totalBuiltUpGaj = (totalBuiltUpSqFt / 9).toFixed(1);
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const projectName = (state.clientName ? `${state.clientName}'s Residence` : 'Modern Residential Villa');

    const rows = [
        ['Project Title:', projectName],
        ['Plot Area:', `${sqFt.toLocaleString()} Sq.Ft (${gaj} Gaj)`],
        ['Total Built-up Area:', `${totalBuiltUpSqFt.toLocaleString()} Sq.Ft (${totalBuiltUpGaj} Gaj)`],
        ['Total Floors:', `${numFloors} Floors (G + ${numFloors - 1}) | Ht: ${totalHeightFt.toFixed(1)}' (${(totalHeightFt * 0.3048).toFixed(2)}m)`],
        ['Scale & Date:', `1:50 (1/4" = 1'-0") | ${currentDate} | WORKING DRAWING`]
    ];

    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    rows.forEach((row, rIdx) => {
        const ry = tbY + 72 + rIdx * 19;
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText(row[0], tbX + 14, ry);

        ctx.fillStyle = '#0f172a';
        ctx.font = '600 9px Inter, sans-serif';
        ctx.fillText(row[1], tbX + 125, ry);
    });

    ctx.restore();
}

/**
 * Exports high-resolution PNG elevation sheet with formal title block.
 */
function downloadElevationSheet() {
    const expWidth = 2400;
    const expHeight = 1600;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = expWidth;
    offCanvas.height = expHeight;
    const offCtx = offCanvas.getContext('2d');

    // Render at high resolution
    renderActiveElevation(offCtx, expWidth, expHeight);

    const wFt = state.dimensions ? (state.dimensions.w || 30) : 30;
    const lFt = state.dimensions ? (state.dimensions.l || 50) : 50;
    const tabName = elevationState.tab.toUpperCase();

    const link = document.createElement('a');
    link.download = `Architectural_Elevation_${tabName}_${wFt}x${lFt}.png`;
    link.href = offCanvas.toDataURL('image/png');
    link.click();

    if (typeof showToast === 'function') {
        showToast(`Elevation Sheet (${tabName}) exported successfully in High Resolution!`, 'success');
    }
}

// Window global bindings
window.initElevationView = initElevationView;
window.resetElevationView = resetElevationView;
window.switchElevationTab = switchElevationTab;
window.renderActiveElevation = renderActiveElevation;
window.downloadElevationSheet = downloadElevationSheet;
