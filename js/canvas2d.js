/**
 * ============================================================================
 * blueprint.js - 2D Canvas Blueprint Drawing, Zoom/Pan & Object Manipulation
 * ============================================================================
 */

let canvas = null;
let ctx = null;
let container = null;

let isDrawing = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;
let offsetX = 0, offsetY = 0;

function initBlueprintCanvas() {
    canvas = document.getElementById('blueprint-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    container = document.getElementById('canvas-container');

    setupBlueprintEvents();
}

function resizeCanvas() {
    if (!canvas || !container) {
        initBlueprintCanvas();
    }
    if (!canvas || !container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    offsetX = canvas.width / 2;
    offsetY = canvas.height / 2;
    draw2D();
}

window.addEventListener('resize', resizeCanvas);

// ----------------------------------------------------------------------------
// Zoom & Pan Navigation
// ----------------------------------------------------------------------------

function changeZoom(amount) {
    if (!canvas) return;
    let newZoom = Math.max(0.2, Math.min(5, state.zoom + amount));
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const logicalCenterBefore = {
        x: (centerX - offsetX - state.panX) / state.zoom,
        y: (centerY - offsetY - state.panY) / state.zoom
    };

    state.zoom = newZoom;
    state.panX = centerX - offsetX - (logicalCenterBefore.x * state.zoom);
    state.panY = centerY - offsetY - (logicalCenterBefore.y * state.zoom);
    draw2D();
}

function resetZoom() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    draw2D();
}

function getMouseCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const rawX = (mouseX - offsetX - state.panX) / state.zoom;
    const rawY = (mouseY - offsetY - state.panY) / state.zoom;
    return { rawX, rawY, mouseX, mouseY };
}

// ----------------------------------------------------------------------------
// Drawing Utilities & Architectural Wall Splitting / Healing
// ----------------------------------------------------------------------------

function drawDoor2D(wall) {
    const x1 = wall.x1, y1 = wall.y1;
    const x2 = wall.x2, y2 = wall.y2;
    const r = Math.hypot(x2 - x1, y2 - y1);
    if (r < 1) return;

    const wallAngle = Math.atan2(y2 - y1, x2 - x1);
    const swing = (wall.swing === -1) ? -1 : 1;
    const openAngle = wallAngle + (swing * Math.PI / 2);
    const leafEndX = x1 + Math.cos(openAngle) * r;
    const leafEndY = y1 + Math.sin(openAngle) * r;

    const wallThickFt = wall.thickness === 'thick' ? 0.75 : 0.5;
    const ht = (wallThickFt * state.pixelsPerFoot) / 2;
    const nx = -Math.sin(wallAngle);
    const ny = Math.cos(wallAngle);

    ctx.save();

    // 1. Threshold line across floor opening
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1 / state.zoom;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 2. Door jambs at opening ends
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2 / state.zoom;
    ctx.beginPath();
    ctx.moveTo(x1 - nx * ht, y1 - ny * ht);
    ctx.lineTo(x1 + nx * ht, y1 + ny * ht);
    ctx.moveTo(x2 - nx * ht, y2 - ny * ht);
    ctx.lineTo(x2 + nx * ht, y2 + ny * ht);
    ctx.stroke();

    if (wall.subType === 'channel') {
        // Collapsible sliding iron gate track and folded bars
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2 / state.zoom;
        ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        const barCount = 5;
        const gateFoldLen = r * 0.3;
        for (let i = 0; i <= barCount; i++) {
            const bx = x1 + Math.cos(wallAngle) * (gateFoldLen * (i / barCount));
            const by = y1 + Math.sin(wallAngle) * (gateFoldLen * (i / barCount));
            ctx.beginPath();
            ctx.moveTo(bx - nx * (ht * 0.8), by - ny * (ht * 0.8));
            ctx.lineTo(bx + nx * (ht * 0.8), by + ny * (ht * 0.8));
            ctx.stroke();
        }
        ctx.restore();
        return;
    }

    // 3. Subtle clearance zone indicator (warm amber wash)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.arc(x1, y1, r, wallAngle, openAngle, swing === -1);
    ctx.closePath();
    ctx.fill();

    // 4. Standard 90-degree door swing arc (dashed line)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
    ctx.beginPath();
    ctx.arc(x1, y1, r, wallAngle, openAngle, swing === -1);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Door leaf in open position
    ctx.strokeStyle = wall.subType === 'entrance' ? '#78350f' : '#b45309';
    ctx.lineWidth = (wall.subType === 'entrance' ? 3.5 : 2.5) / state.zoom;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(leafEndX, leafEndY);
    ctx.stroke();

    // 6. Door hinge indicator at (x1, y1)
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(x1, y1, 2.5 / state.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawWindow2D(wall) {
    const x1 = wall.x1, y1 = wall.y1;
    const x2 = wall.x2, y2 = wall.y2;
    const wallAngle = Math.atan2(y2 - y1, x2 - x1);
    const wallThickFt = wall.thickness === 'thick' ? 0.75 : 0.5;
    const ht = (wallThickFt * state.pixelsPerFoot) / 2;
    const nx = -Math.sin(wallAngle);
    const ny = Math.cos(wallAngle);

    ctx.save();

    // 1. Window sill background fill
    ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x1 + nx * ht, y1 + ny * ht);
    ctx.lineTo(x2 + nx * ht, y2 + ny * ht);
    ctx.lineTo(x2 - nx * ht, y2 - ny * ht);
    ctx.lineTo(x1 - nx * ht, y1 - ny * ht);
    ctx.closePath();
    ctx.fill();

    // 2. Outer sill wall-cut lines
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1 / state.zoom;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * ht, y1 + ny * ht);
    ctx.lineTo(x2 + nx * ht, y2 + ny * ht);
    ctx.moveTo(x1 - nx * ht, y1 - ny * ht);
    ctx.lineTo(x2 - nx * ht, y2 - ny * ht);
    ctx.stroke();

    // 3. Window end caps / jambs
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2 / state.zoom;
    ctx.beginPath();
    ctx.moveTo(x1 - nx * ht, y1 - ny * ht);
    ctx.lineTo(x1 + nx * ht, y1 + ny * ht);
    ctx.moveTo(x2 - nx * ht, y2 - ny * ht);
    ctx.lineTo(x2 + nx * ht, y2 + ny * ht);
    ctx.stroke();

    // 4. Central cyan glass pane
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2.5 / state.zoom;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
}

function splitWallWithOpening(wall, pStart, pEnd, type, subType, targetList) {
    if (!wall || !targetList) return null;
    const idx = targetList.indexOf(wall);
    if (idx === -1) return null;

    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const wLen2 = dx * dx + dy * dy;
    const wLen = Math.sqrt(wLen2);
    if (wLen < 2) return null;

    let t1 = ((pStart.x - wall.x1) * dx + (pStart.y - wall.y1) * dy) / wLen2;
    let t2 = ((pEnd.x - wall.x1) * dx + (pEnd.y - wall.y1) * dy) / wLen2;

    let openingLen = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    if (type === 'door') {
        let lenFt = openingLen / state.pixelsPerFoot;
        if (subType === 'room') lenFt = 3;
        else if (subType === 'entrance') lenFt = Math.max(4, Math.min(lenFt, 5));
        else if (subType === 'channel') lenFt = Math.min(lenFt, 15);
        openingLen = lenFt * state.pixelsPerFoot;
    } else if (type === 'window') {
        let lenFt = Math.max(2.5, openingLen / state.pixelsPerFoot);
        openingLen = lenFt * state.pixelsPerFoot;
    }

    const tSpan = Math.min(1, openingLen / wLen);
    const forward = (t2 >= t1);
    let tA, tB;
    if (forward) {
        tA = Math.max(0, Math.min(1 - tSpan, t1));
        tB = tA + tSpan;
    } else {
        tB = Math.min(1, Math.max(tSpan, t1));
        tA = tB - tSpan;
    }

    const cutA = { x: wall.x1 + tA * dx, y: wall.y1 + tA * dy };
    const cutB = { x: wall.x1 + tB * dx, y: wall.y1 + tB * dy };

    const doorP1 = forward ? cutA : cutB;
    const doorP2 = forward ? cutB : cutA;

    targetList.splice(idx, 1);

    // 1. Left Wall Segment
    if (Math.hypot(cutA.x - wall.x1, cutA.y - wall.y1) > 2) {
        targetList.push({
            x1: wall.x1,
            y1: wall.y1,
            x2: cutA.x,
            y2: cutA.y,
            type: wall.type || 'wall',
            thickness: wall.thickness || 'thin',
            customMaterial: wall.customMaterial || null
        });
    }

    // 2. Door/Window Opening Segment
    const openingItem = {
        x1: doorP1.x,
        y1: doorP1.y,
        x2: doorP2.x,
        y2: doorP2.y,
        type: type,
        subType: subType,
        thickness: wall.thickness || 'thin',
        swing: 1,
        customMaterial: wall.customMaterial || null
    };
    targetList.push(openingItem);

    // 3. Right Wall Segment
    if (Math.hypot(wall.x2 - cutB.x, wall.y2 - cutB.y) > 2) {
        targetList.push({
            x1: cutB.x,
            y1: cutB.y,
            x2: wall.x2,
            y2: wall.y2,
            type: wall.type || 'wall',
            thickness: wall.thickness || 'thin',
            customMaterial: wall.customMaterial || null
        });
    }

    return openingItem;
}

function healWallAt(item, list = null) {
    if (!item || (item.type !== 'door' && item.type !== 'window')) return;

    if (!list) {
        if (state.outerWalls.includes(item)) list = state.outerWalls;
        else if (state.partitions.includes(item)) list = state.partitions;
        else list = state.partitions;
    }

    const eps = 5;
    const p1 = { x: item.x1, y: item.y1 };
    const p2 = { x: item.x2, y: item.y2 };
    const doorAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    let segAtP1 = null;
    let segAtP2 = null;
    let p1OuterEnd = null;
    let p2OuterEnd = null;

    for (let i = 0; i < list.length; i++) {
        const w = list[i];
        if (w === item || w.type === 'door' || w.type === 'window') continue;

        const wAngle = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
        if (Math.abs(Math.sin(doorAngle - wAngle)) > 0.05) continue;

        const d11 = Math.hypot(w.x1 - p1.x, w.y1 - p1.y);
        const d12 = Math.hypot(w.x2 - p1.x, w.y2 - p1.y);
        const d21 = Math.hypot(w.x1 - p2.x, w.y1 - p2.y);
        const d22 = Math.hypot(w.x2 - p2.x, w.y2 - p2.y);

        if (!segAtP1 && d11 < eps) {
            segAtP1 = w;
            p1OuterEnd = { x: w.x2, y: w.y2 };
        } else if (!segAtP1 && d12 < eps) {
            segAtP1 = w;
            p1OuterEnd = { x: w.x1, y: w.y1 };
        } else if (!segAtP2 && d21 < eps) {
            segAtP2 = w;
            p2OuterEnd = { x: w.x2, y: w.y2 };
        } else if (!segAtP2 && d22 < eps) {
            segAtP2 = w;
            p2OuterEnd = { x: w.x1, y: w.y1 };
        }
    }

    if (segAtP1 && segAtP2 && segAtP1 !== segAtP2) {
        const mergedWall = {
            x1: p1OuterEnd.x,
            y1: p1OuterEnd.y,
            x2: p2OuterEnd.x,
            y2: p2OuterEnd.y,
            type: segAtP1.type || 'wall',
            thickness: item.thickness || segAtP1.thickness || 'thin'
        };
        const idx1 = list.indexOf(segAtP1);
        if (idx1 > -1) list.splice(idx1, 1);
        const idx2 = list.indexOf(segAtP2);
        if (idx2 > -1) list.splice(idx2, 1);
        list.push(mergedWall);
    } else if (segAtP1) {
        if (Math.hypot(segAtP1.x1 - p1OuterEnd.x, segAtP1.y1 - p1OuterEnd.y) < 1) {
            segAtP1.x2 = p2.x;
            segAtP1.y2 = p2.y;
        } else {
            segAtP1.x1 = p2.x;
            segAtP1.y1 = p2.y;
        }
    } else if (segAtP2) {
        if (Math.hypot(segAtP2.x1 - p2OuterEnd.x, segAtP2.y1 - p2OuterEnd.y) < 1) {
            segAtP2.x2 = p1.x;
            segAtP2.y2 = p1.y;
        } else {
            segAtP2.x1 = p1.x;
            segAtP2.y1 = p1.y;
        }
    } else {
        list.push({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            type: 'wall',
            thickness: item.thickness || 'thin'
        });
    }
}

function drawRooms() {
    state.rooms.forEach((room) => {
        ctx.fillStyle = room.vastuInfo.color === 'green' ? '#16a34a' :
            (room.vastuInfo.color === 'red' ? '#dc2626' :
            (room.vastuInfo.color === 'blue' ? '#3b82f6' : '#ca8a04'));
        ctx.beginPath();
        ctx.arc(room.x, room.y, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(room.type.charAt(0), room.x, room.y);

        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(room.type, room.x, room.y + 22);
    });
}

function drawStaticDimensions() {
    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const drawDim = (x1, y1, x2, y2, offset) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distFt = (Math.hypot(dx, dy) / state.pixelsPerFoot).toFixed(1);
        if (distFt < 0.5) return;
        const midX = x1 + dx / 2;
        const midY = y1 + dy / 2;
        const angle = Math.atan2(dy, dx);

        const textX = midX - Math.sin(angle) * offset;
        const textY = midY + Math.cos(angle) * offset;

        ctx.save();
        ctx.translate(textX, textY);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        const w = ctx.measureText(distFt + ' ft').width + 12;
        ctx.fillRect(-w / 2, -10, w, 20);
        ctx.fillStyle = '#0f766e';
        ctx.fillText(distFt + ' ft', 0, 0);
        ctx.restore();
    };

    if (state.boundaryPolygon.length === 4) {
        const p = state.boundaryPolygon;
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            drawDim(p[i].x, p[i].y, p[next].x, p[next].y, 25);
        }
    }
    state.partitions.forEach(w => drawDim(w.x1, w.y1, w.x2, w.y2, 15));
}

function drawMeasurementLine(m, isLive = false) {
    const x1 = m.x1, y1 = m.y1;
    const x2 = m.x2, y2 = m.y2;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 2) return;

    const ftVal = m.distFt || (dist / state.pixelsPerFoot).toFixed(1);
    const totalInches = Math.round((dist / state.pixelsPerFoot) * 12);
    const ftPart = Math.floor(totalInches / 12);
    const inPart = totalInches % 12;
    const formattedText = `${ftVal} ft (${ftPart}' ${inPart}")`;

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const tickLen = 7 / state.zoom;

    ctx.save();

    // Magenta / Pink dashed measurement dimension line
    ctx.setLineDash([5 / state.zoom, 4 / state.zoom]);
    ctx.strokeStyle = isLive ? '#f43f5e' : '#db2777';
    ctx.lineWidth = 2 / state.zoom;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Perpendicular anchor tick bars at both endpoints
    ctx.setLineDash([]);
    ctx.lineWidth = 2 / state.zoom;
    ctx.beginPath();
    ctx.moveTo(x1 - nx * tickLen, y1 - ny * tickLen);
    ctx.lineTo(x1 + nx * tickLen, y1 + ny * tickLen);
    ctx.moveTo(x2 - nx * tickLen, y2 - ny * tickLen);
    ctx.lineTo(x2 + nx * tickLen, y2 + ny * tickLen);
    ctx.stroke();

    // Anchor endpoint dots
    const dotRadius = 3.5 / state.zoom;
    ctx.fillStyle = '#db2777';
    ctx.beginPath();
    ctx.arc(x1, y1, dotRadius, 0, Math.PI * 2);
    ctx.arc(x2, y2, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Rounded rectangular badge pill at midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const fontSize = Math.max(10, 11 / state.zoom);
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textMetrics = ctx.measureText(formattedText);
    const pillPadX = 8 / state.zoom;
    const pillPadY = 4 / state.zoom;
    const pillW = textMetrics.width + pillPadX * 2;
    const pillH = (14 / state.zoom) + pillPadY * 2;
    const radius = pillH / 2;

    ctx.save();
    ctx.translate(midX, midY);

    // Pill drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, radius);
    } else {
        ctx.rect(-pillW / 2, -pillH / 2, pillW, pillH);
    }
    ctx.fill();

    // Magenta badge pill border
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#db2777';
    ctx.lineWidth = 1.4 / state.zoom;
    ctx.stroke();

    // Label text inside badge pill
    ctx.fillStyle = '#be185d';
    ctx.fillText(formattedText, 0, 0);

    ctx.restore();
    ctx.restore();
}

// ----------------------------------------------------------------------------
// Architectural Staircase 2D Rendering & Hit-Testing
// ----------------------------------------------------------------------------

function isPointInStair(px, py, stair) {
    if (!stair) return false;
    const ppf = state.pixelsPerFoot || 15;
    const cx = stair.x !== undefined ? stair.x : (stair.x1 + stair.x2) / 2;
    const cy = stair.y !== undefined ? stair.y : (stair.y1 + stair.y2) / 2;
    const w = (stair.widthFt || 6.5) * ppf;
    const l = (stair.lengthFt || 10.5) * ppf;

    // Transform point into local un-rotated stair coordinate space
    const rad = -((stair.rotation || 0) * Math.PI) / 180;
    const dx = px - cx;
    const dy = py - cy;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);

    const margin = 10 / state.zoom;
    return (lx >= -w / 2 - margin && lx <= w / 2 + margin &&
            ly >= -l / 2 - margin && ly <= l / 2 + margin);
}

function drawStaircase2D(asset, isGhost = false) {
    const ppf = state.pixelsPerFoot || 15;
    ctx.save();

    const cx = asset.x !== undefined ? asset.x : (asset.x1 + asset.x2) / 2;
    const cy = asset.y !== undefined ? asset.y : (asset.y1 + asset.y2) / 2;
    const rot = asset.rotation || 0;
    const isFlipped = !!asset.flip;
    const layout = asset.layout || 'u_shape';
    const numSteps = asset.numSteps || 20;
    const fwFt = asset.flightWidthFt || 3.0;
    const fw = fwFt * ppf;
    const isSelected = !isGhost && state.selectedObj && state.selectedObj.item === asset;

    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);
    if (isFlipped) ctx.scale(-1, 1);

    if (isGhost) {
        ctx.globalAlpha = 0.65;
    }

    if (layout === 'u_shape') {
        const wellGapFt = 0.5;
        const wellGap = wellGapFt * ppf;
        const totalW = fw * 2 + wellGap;
        const treadsPerFlight = Math.max(1, Math.floor(numSteps / 2) - 1);
        const treadFt = 10 / 12;
        const flightRun = treadsPerFlight * treadFt * ppf;
        const landingDepth = 3.0 * ppf;
        const totalL = landingDepth + flightRun;

        const leftX = -totalW / 2;
        const topY = -totalL / 2; // Mid-landing is at top (5'6" elevation)
        const flight1Left = leftX;
        const flight1Right = leftX + fw;
        const flight2Left = leftX + fw + wellGap;
        const flight2Right = leftX + totalW;

        // 1. Staircase Footprint Background
        ctx.fillStyle = isGhost ? 'rgba(251, 191, 36, 0.25)' : (isSelected ? 'rgba(217, 119, 6, 0.15)' : 'rgba(248, 250, 252, 0.95)');
        ctx.strokeStyle = isSelected ? '#2563eb' : (isGhost ? '#d97706' : '#78350f');
        ctx.lineWidth = (isSelected ? 2.5 : 1.8) / state.zoom;
        ctx.beginPath();
        ctx.rect(leftX, topY, totalW, totalL);
        ctx.fill();
        ctx.stroke();

        // 2. Mid-Landing Slab (at Top, 5'6" elevation)
        ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.35)' : '#fef3c7';
        ctx.beginPath();
        ctx.rect(leftX, topY, totalW, landingDepth);
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.2 / state.zoom;
        ctx.stroke();

        // Landing label
        ctx.fillStyle = '#92400e';
        ctx.font = `bold ${Math.max(9, 10 / state.zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("MID-LANDING (5'6\")", 0, topY + landingDepth / 2);

        // 3. Central Well Gap (Opening between flights)
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.rect(-wellGap / 2, topY + landingDepth, wellGap, flightRun);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.stroke();

        // 4. Flight 1 Treads (Going UP from bottom-left to mid-landing)
        const stepDy = flightRun / treadsPerFlight;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2 / state.zoom;
        for (let i = 1; i <= treadsPerFlight; i++) {
            const sy = topY + landingDepth + (i - 1) * stepDy;
            ctx.beginPath();
            ctx.moveTo(flight1Left, sy);
            ctx.lineTo(flight1Right, sy);
            ctx.stroke();
        }

        // 5. Flight 2 Treads (Going UP from mid-landing to upper floor, right side)
        for (let i = 1; i <= treadsPerFlight; i++) {
            const sy = topY + landingDepth + (i - 1) * stepDy;
            ctx.beginPath();
            ctx.moveTo(flight2Left, sy);
            ctx.lineTo(flight2Right, sy);
            ctx.stroke();
        }

        // 6. Walking Direction Line & Arrow (Flight 1 UP -> Turn 180° -> Flight 2 UP)
        const f1MidX = flight1Left + fw / 2;
        const f2MidX = flight2Left + fw / 2;
        const startWalkY = topY + totalL - 4 / state.zoom;
        const turnWalkY = topY + landingDepth / 2;

        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2 / state.zoom;
        ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.beginPath();
        ctx.moveTo(f1MidX, startWalkY);
        ctx.lineTo(f1MidX, turnWalkY);
        ctx.arc(0, turnWalkY, (wellGap + fw) / 2, Math.PI, 0, false);
        ctx.lineTo(f2MidX, startWalkY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Start circle at entrance
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(f1MidX, startWalkY, 3.5 / state.zoom, 0, Math.PI * 2);
        ctx.fill();

        // Arrow head at exit
        const arrowSize = 6 / state.zoom;
        ctx.beginPath();
        ctx.moveTo(f2MidX, startWalkY);
        ctx.lineTo(f2MidX - arrowSize * 0.7, startWalkY - arrowSize);
        ctx.lineTo(f2MidX + arrowSize * 0.7, startWalkY - arrowSize);
        ctx.closePath();
        ctx.fill();

        // UP / 11' Text labels
        ctx.fillStyle = '#1e3a8a';
        ctx.font = `bold ${Math.max(9, 10 / state.zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('UP', f1MidX, startWalkY + 12 / state.zoom);
        ctx.fillText('11\'', f2MidX, startWalkY + 12 / state.zoom);

        // Ceiling Void Cutout Indicator
        if (asset.autoCutout !== false) {
            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.setLineDash([5 / state.zoom, 3 / state.zoom]);
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(leftX - 3, topY - 3, totalW + 6, totalL + 6);
            ctx.restore();
        }

    } else if (layout === 'l_shape') {
        const treadsPerFlight = Math.max(1, Math.floor(numSteps / 2) - 1);
        const treadFt = 10 / 12;
        const flightRun = treadsPerFlight * treadFt * ppf;
        const totalW = fw + flightRun;
        const totalL = fw + flightRun;

        const leftX = -totalW / 2;
        const topY = -totalL / 2;

        // Background
        ctx.fillStyle = isGhost ? 'rgba(251, 191, 36, 0.25)' : (isSelected ? 'rgba(217, 119, 6, 0.15)' : 'rgba(248, 250, 252, 0.95)');
        ctx.strokeStyle = isSelected ? '#2563eb' : (isGhost ? '#d97706' : '#78350f');
        ctx.lineWidth = (isSelected ? 2.5 : 1.8) / state.zoom;

        // L-Shape polygon outline
        ctx.beginPath();
        ctx.moveTo(leftX, topY);
        ctx.lineTo(leftX + totalW, topY);
        ctx.lineTo(leftX + totalW, topY + fw);
        ctx.lineTo(leftX + fw, topY + fw);
        ctx.lineTo(leftX + fw, topY + totalL);
        ctx.lineTo(leftX, topY + totalL);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Corner Landing Slab at (leftX, topY) of size fw x fw
        ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.35)' : '#fef3c7';
        ctx.fillRect(leftX, topY, fw, fw);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.2 / state.zoom;
        ctx.strokeRect(leftX, topY, fw, fw);

        ctx.fillStyle = '#92400e';
        ctx.font = `bold ${Math.max(8, 9 / state.zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LANDING', leftX + fw / 2, topY + fw / 2);

        // Flight 1 Treads (Vertical from bottom to corner landing)
        const stepDy = flightRun / treadsPerFlight;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2 / state.zoom;
        for (let i = 1; i <= treadsPerFlight; i++) {
            const sy = topY + fw + (i - 1) * stepDy;
            ctx.beginPath();
            ctx.moveTo(leftX, sy);
            ctx.lineTo(leftX + fw, sy);
            ctx.stroke();
        }

        // Flight 2 Treads (Horizontal from corner landing to right)
        const stepDx = flightRun / treadsPerFlight;
        for (let i = 1; i <= treadsPerFlight; i++) {
            const sx = leftX + fw + (i - 1) * stepDx;
            ctx.beginPath();
            ctx.moveTo(sx, topY);
            ctx.lineTo(sx, topY + fw);
            ctx.stroke();
        }

        // Walking Direction Arrow (UP along Flight 1, turn 90°, continue along Flight 2)
        const walkX1 = leftX + fw / 2;
        const walkY1 = topY + totalL - 4 / state.zoom;
        const walkTurnX = leftX + fw / 2;
        const walkTurnY = topY + fw / 2;
        const walkEndX = leftX + totalW - 4 / state.zoom;
        const walkEndY = topY + fw / 2;

        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2 / state.zoom;
        ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.beginPath();
        ctx.moveTo(walkX1, walkY1);
        ctx.lineTo(walkTurnX, walkTurnY);
        ctx.lineTo(walkEndX, walkEndY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Start circle
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(walkX1, walkY1, 3.5 / state.zoom, 0, Math.PI * 2);
        ctx.fill();

        // Arrowhead at end
        const arrowSize = 6 / state.zoom;
        ctx.beginPath();
        ctx.moveTo(walkEndX, walkEndY);
        ctx.lineTo(walkEndX - arrowSize, walkEndY - arrowSize * 0.7);
        ctx.lineTo(walkEndX - arrowSize, walkEndY + arrowSize * 0.7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1e3a8a';
        ctx.font = `bold ${Math.max(9, 10 / state.zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('UP', walkX1, walkY1 + 12 / state.zoom);

        // Ceiling Void Cutout Indicator
        if (asset.autoCutout !== false) {
            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.setLineDash([5 / state.zoom, 3 / state.zoom]);
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(leftX - 3, topY - 3, totalW + 6, totalL + 6);
            ctx.restore();
        }

    } else { // straight
        const treads = Math.max(1, numSteps - 1);
        const treadFt = 10 / 12;
        const totalL = treads * treadFt * ppf;
        const totalW = fw;

        const leftX = -totalW / 2;
        const topY = -totalL / 2;

        // Background
        ctx.fillStyle = isGhost ? 'rgba(251, 191, 36, 0.25)' : (isSelected ? 'rgba(217, 119, 6, 0.15)' : 'rgba(248, 250, 252, 0.95)');
        ctx.strokeStyle = isSelected ? '#2563eb' : (isGhost ? '#d97706' : '#78350f');
        ctx.lineWidth = (isSelected ? 2.5 : 1.8) / state.zoom;
        ctx.strokeRect(leftX, topY, totalW, totalL);
        ctx.fillRect(leftX, topY, totalW, totalL);

        // Treads
        const stepDy = totalL / treads;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2 / state.zoom;
        for (let i = 1; i < treads; i++) {
            const sy = topY + i * stepDy;
            ctx.beginPath();
            ctx.moveTo(leftX, sy);
            ctx.lineTo(leftX + totalW, sy);
            ctx.stroke();
        }

        // Side stringers
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2.5 / state.zoom;
        ctx.beginPath();
        ctx.moveTo(leftX, topY); ctx.lineTo(leftX, topY + totalL);
        ctx.moveTo(leftX + totalW, topY); ctx.lineTo(leftX + totalW, topY + totalL);
        ctx.stroke();

        // Walking arrow from bottom to top
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2 / state.zoom;
        ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.beginPath();
        ctx.moveTo(0, topY + totalL - 4 / state.zoom);
        ctx.lineTo(0, topY + 6 / state.zoom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Start circle
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(0, topY + totalL - 4 / state.zoom, 3.5 / state.zoom, 0, Math.PI * 2);
        ctx.fill();

        // Arrowhead
        const arrowSize = 6 / state.zoom;
        ctx.beginPath();
        ctx.moveTo(0, topY + 6 / state.zoom);
        ctx.lineTo(-arrowSize * 0.7, topY + 6 / state.zoom + arrowSize);
        ctx.lineTo(arrowSize * 0.7, topY + 6 / state.zoom + arrowSize);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1e3a8a';
        ctx.font = `bold ${Math.max(9, 10 / state.zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('UP', 0, topY + totalL + 12 / state.zoom);

        // Ceiling Void Cutout Indicator
        if (asset.autoCutout !== false) {
            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.setLineDash([5 / state.zoom, 3 / state.zoom]);
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(leftX - 3, topY - 3, totalW + 6, totalL + 6);
            ctx.restore();
        }
    }

    // Badge label showing Type and Steps
    const badgeText = `${layout.toUpperCase().replace('_', '-')} (${numSteps} Steps | 11')`;
    ctx.font = `bold ${Math.max(9, 10 / state.zoom)}px Inter, sans-serif`;
    const bw = ctx.measureText(badgeText).width + 8;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(-bw / 2, -10 / state.zoom, bw, 20 / state.zoom);
    ctx.fillStyle = '#78350f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, 0, 0);

    ctx.restore();
}

// ----------------------------------------------------------------------------
// Structural Pillar / Column 2D Helpers & Snap Logic
// ----------------------------------------------------------------------------

function getPillarSnapPoint(rawX, rawY) {
    const ppf = state.pixelsPerFoot || 15;
    const threshold = 18 / state.zoom;

    // 1. Check Wall Corners / Endpoints (Highest Priority)
    const allWalls = [...(state.outerWalls || []), ...(state.partitions || [])];
    let bestCorner = null;
    let minCornerDist = threshold;

    allWalls.forEach(w => {
        const d1 = Math.hypot(rawX - w.x1, rawY - w.y1);
        if (d1 < minCornerDist) {
            minCornerDist = d1;
            bestCorner = { x: w.x1, y: w.y1 };
        }
        const d2 = Math.hypot(rawX - w.x2, rawY - w.y2);
        if (d2 < minCornerDist) {
            minCornerDist = d2;
            bestCorner = { x: w.x2, y: w.y2 };
        }
    });

    if (state.boundaryPolygon && state.boundaryPolygon.length === 4) {
        state.boundaryPolygon.forEach(pt => {
            const d = Math.hypot(rawX - pt.x, rawY - pt.y);
            if (d < minCornerDist) {
                minCornerDist = d;
                bestCorner = { x: pt.x, y: pt.y };
            }
        });
    }

    if (bestCorner) return { x: bestCorner.x, y: bestCorner.y, snapped: 'corner' };

    // 2. Check Wall Lines (Middle Snapping)
    const wallSnap = getClosestWall(rawX, rawY, 16);
    if (wallSnap) {
        return { x: wallSnap.projX, y: wallSnap.projY, snapped: 'wall' };
    }

    // 3. Grid Snapping (1-foot grid in pixels)
    const gridX = Math.round(rawX / ppf) * ppf;
    const gridY = Math.round(rawY / ppf) * ppf;
    return { x: gridX, y: gridY, snapped: 'grid' };
}

function drawPillar2D(pillar, isGhost = false) {
    const ppf = state.pixelsPerFoot || 15;
    const isQuad = (pillar.subType === 'quad');
    const rotRad = ((pillar.rotation || 0) * Math.PI) / 180;

    ctx.save();
    ctx.translate(pillar.x, pillar.y);
    ctx.rotate(rotRad);

    if (isQuad) {
        const wPx = (pillar.w || 1.0) * ppf;
        const dPx = (pillar.d || 2.0) * ppf;
        const halfW = wPx / 2;
        const halfD = dPx / 2;

        if (isGhost) {
            ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2 / state.zoom;
            ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
            ctx.fillRect(-halfW, -halfD, wPx, dPx);
            ctx.strokeRect(-halfW, -halfD, wPx, dPx);
            ctx.setLineDash([]);
        } else {
            // Solid dark-slate rectangle
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-halfW, -halfD, wPx, dPx);
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(-halfW, -halfD, wPx, dPx);

            // Structural Crosshatch ("X")
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.2 / state.zoom;
            ctx.beginPath();
            ctx.moveTo(-halfW, -halfD);
            ctx.lineTo(halfW, halfD);
            ctx.moveTo(halfW, -halfD);
            ctx.lineTo(-halfW, halfD);
            ctx.stroke();

            // Label badge
            if (state.showDimensions && state.zoom >= 0.75) {
                ctx.fillStyle = '#cbd5e1';
                ctx.font = `bold ${Math.max(8, 9 / state.zoom)}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const label = `${pillar.w || 1}x${pillar.d || 2}'`;
                ctx.fillText(label, 0, 0);
            }
        }
    } else {
        // Circular pillar
        const rPx = (pillar.radius || 0.75) * ppf;

        if (isGhost) {
            ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2 / state.zoom;
            ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
            ctx.beginPath();
            ctx.arc(0, 0, rPx, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Solid dark-slate circle
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(0, 0, rPx, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.stroke();

            // Center Crosshair
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.2 / state.zoom;
            ctx.beginPath();
            ctx.moveTo(-rPx * 0.75, 0);
            ctx.lineTo(rPx * 0.75, 0);
            ctx.moveTo(0, -rPx * 0.75);
            ctx.lineTo(0, rPx * 0.75);
            ctx.stroke();

            // Center small circle
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1.5, rPx * 0.15), 0, Math.PI * 2);
            ctx.fillStyle = '#f8fafc';
            ctx.fill();

            // Label badge
            if (state.showDimensions && state.zoom >= 0.75) {
                ctx.fillStyle = '#cbd5e1';
                ctx.font = `bold ${Math.max(7, 8 / state.zoom)}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const label = `ø${pillar.diameter || (pillar.radius * 2) || 1.5}'`;
                ctx.fillText(label, 0, -rPx - (6 / state.zoom));
            }
        }
    }

    ctx.restore();
}

function isPointInPillar(px, py, p) {
    const ppf = state.pixelsPerFoot || 15;
    const dx = px - p.x;
    const dy = py - p.y;
    const rotRad = (-(p.rotation || 0) * Math.PI) / 180;
    const lx = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
    const ly = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);

    if (p.subType === 'circle') {
        const r = (p.radius || 0.75) * ppf + (6 / state.zoom);
        return Math.hypot(dx, dy) <= r;
    } else {
        const hw = ((p.w || 1.0) * ppf) / 2 + (6 / state.zoom);
        const hd = ((p.d || 2.0) * ppf) / 2 + (6 / state.zoom);
        return Math.abs(lx) <= hw && Math.abs(ly) <= hd;
    }
}

// ----------------------------------------------------------------------------
// MEP (Mechanical, Electrical, Plumbing & Sanitary) 2D CAD Engine
// ----------------------------------------------------------------------------

function isPointInMep(px, py, m) {
    const ppf = state.pixelsPerFoot || 15;
    const threshold = (m.type === 'mep_septic_tank' || m.type === 'mep_overhead_tank') ? (2.5 * ppf) : (1.6 * ppf);
    return Math.hypot(px - m.x, py - m.y) <= (threshold + 5 / state.zoom);
}

function rotateCurrentMep(deltaDeg = 90) {
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type && state.selectedObj.item.type.startsWith('mep_')) {
        saveHistory();
        state.selectedObj.item.rotation = ((state.selectedObj.item.rotation || 0) + deltaDeg) % 360;
        draw2D();
        if (state.step === 6 && typeof generate3D === 'function') generate3D();
    }
}
window.rotateCurrentMep = rotateCurrentMep;

function drawMepAsset2D(m, isGhost = false) {
    const ppf = state.pixelsPerFoot || 15;
    const rotRad = ((m.rotation || 0) * Math.PI) / 180;

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(rotRad);

    const isSelected = (!isGhost && state.selectedObj && state.selectedObj.item === m);

    // If selected in edit mode, draw soft selection glow ring
    if (isSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, 2.2 * ppf, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 184, 166, 0.15)';
        ctx.fill();
        ctx.strokeStyle = '#0d9488';
        ctx.lineWidth = 1.5 / state.zoom;
        ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
        ctx.stroke();
        ctx.restore();
    }

    if (isGhost) {
        ctx.globalAlpha = 0.6;
    }

    switch (m.type) {
        case 'mep_ceiling_fan': {
            const sweepR = 1.8 * ppf;
            // Sweep circle dashed
            ctx.beginPath();
            ctx.arc(0, 0, sweepR, 0, Math.PI * 2);
            ctx.strokeStyle = isGhost ? '#60a5fa' : '#0284c7';
            ctx.lineWidth = 1 / state.zoom;
            ctx.setLineDash([3 / state.zoom, 2 / state.zoom]);
            ctx.stroke();
            ctx.setLineDash([]);

            // 3 Blades at 0, 120, 240 deg
            for (let i = 0; i < 3; i++) {
                const bAngle = (i * 120 * Math.PI) / 180;
                ctx.save();
                ctx.rotate(bAngle);
                ctx.beginPath();
                ctx.moveTo(0.3 * ppf, -0.15 * ppf);
                ctx.lineTo(sweepR - 0.1 * ppf, -0.22 * ppf);
                ctx.quadraticCurveTo(sweepR + 0.1 * ppf, 0, sweepR - 0.1 * ppf, 0.22 * ppf);
                ctx.lineTo(0.3 * ppf, 0.15 * ppf);
                ctx.closePath();
                ctx.fillStyle = isGhost ? '#93c5fd' : '#38bdf8';
                ctx.fill();
                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 1 / state.zoom;
                ctx.stroke();
                ctx.restore();
            }

            // Motor Hub
            ctx.beginPath();
            ctx.arc(0, 0, 0.45 * ppf, 0, Math.PI * 2);
            ctx.fillStyle = '#0284c7';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.stroke();

            // Center Pin
            ctx.beginPath();
            ctx.arc(0, 0, 0.15 * ppf, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Label
            if (state.zoom >= 0.7) {
                ctx.fillStyle = '#0369a1';
                ctx.font = `bold ${Math.max(7, 8 / state.zoom)}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('FAN', 0, -sweepR - 3 / state.zoom);
            }
            break;
        }

        case 'mep_wall_ac': {
            const w = 3.2 * ppf, h = 0.9 * ppf;
            ctx.fillStyle = '#f0fdf4';
            ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(-w / 2, -h / 2, w, h);

            // Louvers
            ctx.strokeStyle = '#86efac';
            ctx.lineWidth = 1 / state.zoom;
            for (let lx = -w / 2 + 0.3 * ppf; lx < w / 2 - 0.2 * ppf; lx += 0.4 * ppf) {
                ctx.beginPath();
                ctx.moveTo(lx, -h / 4);
                ctx.lineTo(lx, h / 4);
                ctx.stroke();
            }

            // Green power LED
            ctx.beginPath();
            ctx.arc(w / 2 - 0.3 * ppf, 0, 2 / state.zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#22c55e';
            ctx.fill();

            // Label
            ctx.fillStyle = '#15803d';
            ctx.font = `bold ${Math.max(7, 8 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('AC', 0, 0);
            break;
        }

        case 'mep_switchboard': {
            const w = 1.2 * ppf, h = 0.5 * ppf;
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.strokeStyle = '#ca8a04';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(-w / 2, -h / 2, w, h);

            // Switches
            for (let i = 0; i < 3; i++) {
                const sx = -w / 2 + 0.25 * ppf + i * 0.25 * ppf;
                ctx.fillStyle = '#854d0e';
                ctx.fillRect(sx - 1 / state.zoom, -h / 4, 2 / state.zoom, h / 2);
            }

            // Red indicator
            ctx.beginPath();
            ctx.arc(w / 2 - 0.2 * ppf, 0, 1.8 / state.zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();

            // Label
            ctx.fillStyle = '#713f12';
            ctx.font = `bold ${Math.max(6, 7 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('SB', 0, -h / 2 - 2 / state.zoom);
            break;
        }

        case 'mep_light_ceiling': {
            const r = 0.6 * ppf;
            // Halo glow
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
            ctx.fill();

            // Center fixture
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = '#fef08a';
            ctx.fill();
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.stroke();

            // 4 Rays
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 1 / state.zoom;
            for (let a = 0; a < 4; a++) {
                const rad = (a * Math.PI) / 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(rad) * r, Math.sin(rad) * r);
                ctx.lineTo(Math.cos(rad) * (r * 1.6), Math.sin(rad) * (r * 1.6));
                ctx.stroke();
            }

            ctx.fillStyle = '#854d0e';
            ctx.font = `bold ${Math.max(6, 7 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('L', 0, 0);
            break;
        }

        case 'mep_mcb_box': {
            const s = 1.4 * ppf;
            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(-s / 2, -s / 2, s, s);
            ctx.strokeStyle = '#c2410c';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(-s / 2, -s / 2, s, s);

            // Diagonal slash
            ctx.beginPath();
            ctx.moveTo(-s / 2, -s / 2);
            ctx.lineTo(s / 2, s / 2);
            ctx.strokeStyle = '#ea580c';
            ctx.stroke();

            ctx.fillStyle = '#9a3412';
            ctx.font = `bold ${Math.max(6, 7 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DB', 0, 0);
            break;
        }

        case 'mep_wc': {
            // Cistern
            const cw = 1.6 * ppf, ch = 0.7 * ppf;
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-cw / 2, -ch, cw, ch);
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(-cw / 2, -ch, cw, ch);

            // Oval Bowl
            const bw = 0.65 * ppf, bl = 1.0 * ppf;
            ctx.beginPath();
            ctx.ellipse(0, 0.4 * ppf, bw, bl, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.stroke();

            // Inner water cavity
            ctx.beginPath();
            ctx.ellipse(0, 0.45 * ppf, bw * 0.6, bl * 0.6, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#e0f2fe';
            ctx.fill();

            // Label
            ctx.fillStyle = '#0369a1';
            ctx.font = `bold ${Math.max(7, 8 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('WC', 0, 0.45 * ppf);
            break;
        }

        case 'mep_wash_basin': {
            const w = 1.8 * ppf, d = 1.3 * ppf;
            ctx.beginPath();
            ctx.roundRect(-w / 2, -d / 2, w, d, [4, 4, 12, 12]);
            ctx.fillStyle = '#f8fafc';
            ctx.fill();
            ctx.strokeStyle = '#0891b2';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.stroke();

            // Basin inner bowl
            ctx.beginPath();
            ctx.ellipse(0, 0.1 * ppf, 0.65 * ppf, 0.45 * ppf, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#e0f2fe';
            ctx.fill();
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1 / state.zoom;
            ctx.stroke();

            // Faucet node
            ctx.beginPath();
            ctx.arc(0, -d / 2 + 0.25 * ppf, 2.5 / state.zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#64748b';
            ctx.fill();

            // Label
            ctx.fillStyle = '#0e7490';
            ctx.font = `bold ${Math.max(6, 7 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('WB', 0, 0.1 * ppf);
            break;
        }

        case 'mep_shower': {
            const r = 0.65 * ppf;
            // Wall arm
            ctx.beginPath();
            ctx.moveTo(0, -1.0 * ppf);
            ctx.lineTo(0, 0);
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2 / state.zoom;
            ctx.stroke();

            // Rose
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = '#e0f2fe';
            ctx.fill();
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.stroke();

            // Spray dots
            for (let a = 0; a < 6; a++) {
                const rad = (a * 60 * Math.PI) / 180;
                ctx.beginPath();
                ctx.arc(Math.cos(rad) * 0.4 * r, Math.sin(rad) * 0.4 * r, 1.2 / state.zoom, 0, Math.PI * 2);
                ctx.fillStyle = '#0284c7';
                ctx.fill();
            }

            ctx.fillStyle = '#0369a1';
            ctx.font = `bold ${Math.max(6, 7 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('SH', 0, r + 4 / state.zoom);
            break;
        }

        case 'mep_drain_trap': {
            const s = 0.9 * ppf;
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(-s / 2, -s / 2, s, s);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(-s / 2, -s / 2, s, s);

            // Circular grate
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2);
            ctx.fillStyle = '#e2e8f0';
            ctx.fill();
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1 / state.zoom;
            ctx.stroke();

            // Cross
            ctx.beginPath();
            ctx.moveTo(-s * 0.35, 0); ctx.lineTo(s * 0.35, 0);
            ctx.moveTo(0, -s * 0.35); ctx.lineTo(0, s * 0.35);
            ctx.stroke();

            ctx.fillStyle = '#475569';
            ctx.font = `bold ${Math.max(6, 7 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('FD', 0, -s / 2 - 2 / state.zoom);
            break;
        }

        case 'mep_kitchen_sink': {
            const w = 3.0 * ppf, d = 1.6 * ppf;
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-w / 2, -d / 2, w, d);
            ctx.strokeStyle = '#059669';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.strokeRect(-w / 2, -d / 2, w, d);

            // Double Bowl
            const bw = 1.2 * ppf, bd = 1.2 * ppf;
            [-w / 4, w / 4].forEach(bx => {
                ctx.fillStyle = '#e0f2fe';
                ctx.fillRect(bx - bw / 2, -bd / 2, bw, bd);
                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 1 / state.zoom;
                ctx.strokeRect(bx - bw / 2, -bd / 2, bw, bd);

                // Drain
                ctx.beginPath();
                ctx.arc(bx, 0, 2 / state.zoom, 0, Math.PI * 2);
                ctx.fillStyle = '#64748b';
                ctx.fill();
            });

            // Tap
            ctx.beginPath();
            ctx.arc(0, -d / 2 + 0.25 * ppf, 2.5 / state.zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#059669';
            ctx.fill();

            ctx.fillStyle = '#047857';
            ctx.font = `bold ${Math.max(6, 7 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('SINK', 0, d / 2 + 5 / state.zoom);
            break;
        }

        case 'mep_overhead_tank': {
            const r = 2.0 * ppf;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = '#dbeafe';
            ctx.fill();
            ctx.strokeStyle = '#1e3a8a';
            ctx.lineWidth = 2 / state.zoom;
            ctx.stroke();

            // Inner rib circle
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.stroke();

            // 4 Rib lines
            ctx.beginPath();
            ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
            ctx.moveTo(0, -r); ctx.lineTo(0, r);
            ctx.stroke();

            ctx.fillStyle = '#1e3a8a';
            ctx.font = `bold ${Math.max(7, 8 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('OHT (1000L)', 0, 0);
            break;
        }

        case 'mep_septic_tank': {
            const w = 4.5 * ppf, h = 3.0 * ppf;
            ctx.fillStyle = '#f5f5f4';
            ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.strokeStyle = '#44403c';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.setLineDash([5 / state.zoom, 3 / state.zoom]);
            ctx.strokeRect(-w / 2, -h / 2, w, h);
            ctx.setLineDash([]);

            // 2 Manholes
            [-w / 4, w / 4].forEach(mx => {
                ctx.beginPath();
                ctx.arc(mx, 0, 0.6 * ppf, 0, Math.PI * 2);
                ctx.fillStyle = '#e7e5e4';
                ctx.fill();
                ctx.strokeStyle = '#78716c';
                ctx.lineWidth = 1 / state.zoom;
                ctx.stroke();
            });

            ctx.fillStyle = '#44403c';
            ctx.font = `bold ${Math.max(7, 8 / state.zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SEPTIC TANK', 0, 0);
            break;
        }
    }

    ctx.restore();
}

function drawMepSchematicConnections(mepList) {
    if (!mepList || mepList.length === 0) return;

    // 1. Electrical Wiring Runs (Switchboard to Lights & Fans)
    const switchboards = mepList.filter(m => m.type === 'mep_switchboard');
    const fixtures = mepList.filter(m => m.type === 'mep_light_ceiling' || m.type === 'mep_ceiling_fan' || m.type === 'mep_wall_ac');

    switchboards.forEach(sb => {
        fixtures.forEach(fix => {
            const dist = Math.hypot(fix.x - sb.x, fix.y - sb.y);
            if (dist < 25 * state.pixelsPerFoot) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(sb.x, sb.y);
                const midX = (sb.x + fix.x) / 2 + (fix.y - sb.y) * 0.15;
                const midY = (sb.y + fix.y) / 2 - (fix.x - sb.x) * 0.15;
                ctx.quadraticCurveTo(midX, midY, fix.x, fix.y);
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 1.5 / state.zoom;
                ctx.setLineDash([4 / state.zoom, 3 / state.zoom]);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(midX, midY, 2 / state.zoom, 0, Math.PI * 2);
                ctx.fillStyle = '#059669';
                ctx.fill();
                ctx.restore();
            }
        });
    });

    // 2. Plumbing Lines (Cold Water Inlet & Drainage Outlets)
    const plumbingFixtures = mepList.filter(m => ['mep_wc', 'mep_wash_basin', 'mep_kitchen_sink', 'mep_shower'].includes(m.type));
    const drains = mepList.filter(m => m.type === 'mep_drain_trap');

    plumbingFixtures.forEach(fix => {
        ctx.save();
        // Cyan cold water inlet stub
        ctx.beginPath();
        ctx.arc(fix.x - 6 / state.zoom, fix.y - 6 / state.zoom, 2.5 / state.zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#0ea5e9';
        ctx.fill();

        // Drainage line to nearest floor drain
        if (drains.length > 0) {
            let nearestDrain = null;
            let minDist = Infinity;
            drains.forEach(d => {
                const dist = Math.hypot(d.x - fix.x, d.y - fix.y);
                if (dist < minDist && dist < 20 * state.pixelsPerFoot) {
                    minDist = dist;
                    nearestDrain = d;
                }
            });
            if (nearestDrain) {
                ctx.beginPath();
                ctx.moveTo(fix.x, fix.y);
                ctx.lineTo(nearestDrain.x, nearestDrain.y);
                ctx.strokeStyle = '#ea580c';
                ctx.lineWidth = 1.2 / state.zoom;
                ctx.setLineDash([3 / state.zoom, 3 / state.zoom]);
                ctx.stroke();
            }
        }
        ctx.restore();
    });
}

// ----------------------------------------------------------------------------
// Exterior Compound Wall, Main Gate & Car Ramp 2D CAD Blueprint Engine
// ----------------------------------------------------------------------------
function drawCompoundYardAndRamp2D(ctx, cp, p, ppf) {
    if (!cp || cp.length !== 4) return;
    const doorSide = state.door || 'front';
    const cSettings = state.compound || {};

    // 1. Property Yard Plinth Fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cp[0].x, cp[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(cp[i].x, cp[i].y);
    ctx.closePath();
    ctx.fillStyle = '#f8fafc'; // Clean yard paving
    ctx.fill();

    // Subtle setback boundary guideline
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 2. Car Parking Ramp (connecting from main gate to road)
    if (cSettings.addRamp !== false) {
        let A, B, nx, ny;
        if (doorSide === 'front') { A = cp[0]; B = cp[1]; nx = 0; ny = 1; }
        else if (doorSide === 'right') { A = cp[1]; B = cp[2]; nx = 1; ny = 0; }
        else if (doorSide === 'back') { A = cp[2]; B = cp[3]; nx = 0; ny = -1; }
        else { A = cp[3]; B = cp[0]; nx = -1; ny = 0; }

        const dx = B.x - A.x, dy = B.y - A.y;
        const len = Math.hypot(dx, dy);
        if (len > 5) {
            const tx = dx / len, ty = dy / len;
            const gateW = Math.min((cSettings.gateWidthFt || 9) * ppf, len - 3 * ppf);
            const midX = (A.x + B.x) / 2, midY = (A.y + B.y) / 2;

            const gp1x = midX - (gateW / 2) * tx, gp1y = midY - (gateW / 2) * ty;
            const gp2x = midX + (gateW / 2) * tx, gp2y = midY + (gateW / 2) * ty;
            const rampLen = 4.5 * ppf; // 4.5 ft slope into road

            const r1 = { x: gp1x, y: gp1y };
            const r2 = { x: gp2x, y: gp2y };
            const r3 = { x: gp2x + nx * rampLen, y: gp2y + ny * rampLen };
            const r4 = { x: gp1x + nx * rampLen, y: gp1y + ny * rampLen };

            ctx.save();
            // Concrete ramp slab
            ctx.beginPath();
            ctx.moveTo(r1.x, r1.y);
            ctx.lineTo(r2.x, r2.y);
            ctx.lineTo(r3.x, r3.y);
            ctx.lineTo(r4.x, r4.y);
            ctx.closePath();
            ctx.fillStyle = '#94a3b8';
            ctx.fill();
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Ramp Hatching Chevrons pointing down towards road
            const midTop = { x: (r1.x + r2.x) / 2, y: (r1.y + r2.y) / 2 };
            const midBot = { x: (r3.x + r4.x) / 2, y: (r3.y + r4.y) / 2 };

            ctx.beginPath();
            ctx.moveTo(midTop.x, midTop.y);
            ctx.lineTo(midBot.x, midBot.y);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            for (let k = 0.25; k <= 0.75; k += 0.25) {
                const px = midTop.x + (midBot.x - midTop.x) * k;
                const py = midTop.y + (midBot.y - midTop.y) * k;
                const wing = 0.8 * ppf;
                ctx.beginPath();
                ctx.moveTo(px - tx * wing - nx * 0.4 * ppf, py - ty * wing - ny * 0.4 * ppf);
                ctx.lineTo(px, py);
                ctx.lineTo(px + tx * wing - nx * 0.4 * ppf, py + ty * wing - ny * 0.4 * ppf);
                ctx.stroke();
            }

            // Ramp Text Label
            ctx.font = `bold ${Math.max(8, 9 / state.zoom)}px Inter, sans-serif`;
            ctx.fillStyle = '#0f172a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('RAMP (SLOPE)', (midTop.x + midBot.x) / 2, (midTop.y + midBot.y) / 2);
            ctx.restore();
        }
    }
}

function drawCompoundWall2D(ctx, cp, p, ppf) {
    if (!cp || cp.length !== 4) return;
    const doorSide = state.door || 'front';
    const cSettings = state.compound || {};
    const cThick = 0.65 * ppf; // 0.65 ft masonry wall
    const gateStyle = cSettings.gateStyle || 'sliding';

    const sides = [
        { name: 'front', p1: cp[0], p2: cp[1], nx: 0, ny: 1 },
        { name: 'right', p1: cp[1], p2: cp[2], nx: 1, ny: 0 },
        { name: 'back',  p1: cp[2], p2: cp[3], nx: 0, ny: -1 },
        { name: 'left',  p1: cp[3], p2: cp[0], nx: -1, ny: 0 }
    ];

    let gatePosts = null;

    sides.forEach(s => {
        const dx = s.p2.x - s.p1.x;
        const dy = s.p2.y - s.p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 5) return;
        const tx = dx / len, ty = dy / len;

        if (s.name !== doorSide) {
            // Solid Wall Line
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(s.p1.x, s.p1.y);
            ctx.lineTo(s.p2.x, s.p2.y);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = cThick;
            ctx.lineCap = 'square';
            ctx.stroke();

            // Coping Cap Line
            ctx.beginPath();
            ctx.moveTo(s.p1.x, s.p1.y);
            ctx.lineTo(s.p2.x, s.p2.y);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = cThick * 0.4;
            ctx.stroke();
            ctx.restore();
        } else {
            // Entrance Side with Gate Opening
            const gateW = Math.min((cSettings.gateWidthFt || 9) * ppf, len - 3.5 * ppf);
            const midX = (s.p1.x + s.p2.x) / 2;
            const midY = (s.p1.y + s.p2.y) / 2;

            const gp1x = midX - (gateW / 2) * tx;
            const gp1y = midY - (gateW / 2) * ty;
            const gp2x = midX + (gateW / 2) * tx;
            const gp2y = midY + (gateW / 2) * ty;

            ctx.save();
            // Wall Segment 1
            ctx.beginPath();
            ctx.moveTo(s.p1.x, s.p1.y);
            ctx.lineTo(gp1x - tx * (0.8 * ppf), gp1y - ty * (0.8 * ppf));
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = cThick;
            ctx.lineCap = 'square';
            ctx.stroke();

            // Wall Segment 2
            ctx.beginPath();
            ctx.moveTo(gp2x + tx * (0.8 * ppf), gp2y + ty * (0.8 * ppf));
            ctx.lineTo(s.p2.x, s.p2.y);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = cThick;
            ctx.lineCap = 'square';
            ctx.stroke();
            ctx.restore();

            gatePosts = {
                gp1: { x: gp1x, y: gp1y },
                gp2: { x: gp2x, y: gp2y },
                mid: { x: midX, y: midY },
                tx, ty, nx: s.nx, ny: s.ny,
                width: gateW
            };
        }
    });

    // Draw 4 Corner Pillars
    const pillarSize = 1.35 * ppf;
    cp.forEach(pt => {
        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.fillRect(pt.x - pillarSize / 2, pt.y - pillarSize / 2, pillarSize, pillarSize);
        ctx.strokeRect(pt.x - pillarSize / 2, pt.y - pillarSize / 2, pillarSize, pillarSize);
        ctx.restore();
    });

    // Draw 2 Gate Post Pillars & Gate Symbol
    if (gatePosts) {
        const postSize = 1.6 * ppf;
        [gatePosts.gp1, gatePosts.gp2].forEach(gp => {
            ctx.save();
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.fillRect(gp.x - postSize / 2, gp.y - postSize / 2, postSize, postSize);
            ctx.strokeRect(gp.x - postSize / 2, gp.y - postSize / 2, postSize, postSize);

            // Gate-Post Night Lantern Indicator (Yellow circle)
            ctx.beginPath();
            ctx.arc(gp.x, gp.y, 0.35 * ppf, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24';
            ctx.fill();
            ctx.restore();
        });

        // Main Gate CAD Blueprint Symbol
        ctx.save();
        const { gp1, gp2, tx, ty, width: gW } = gatePosts;

        if (gateStyle === 'sliding') {
            // Sliding Gate: Offset Line + Slide Direction Arrow
            const offsetDist = 0.4 * ppf;
            const sx1 = gp1.x - gatePosts.nx * offsetDist;
            const sy1 = gp1.y - gatePosts.ny * offsetDist;
            const sx2 = gp2.x - gatePosts.nx * offsetDist;
            const sy2 = gp2.y - gatePosts.ny * offsetDist;

            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Slide arrow symbol
            ctx.beginPath();
            ctx.moveTo(sx1 + tx * (gW * 0.3), sy1 + ty * (gW * 0.3));
            ctx.lineTo(sx1 + tx * (gW * 0.7), sy1 + ty * (gW * 0.7));
            ctx.strokeStyle = '#059669';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = `bold ${Math.max(8, 9 / state.zoom)}px Inter, sans-serif`;
            ctx.fillStyle = '#059669';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('SLIDING GATE', gatePosts.mid.x - gatePosts.nx * 0.8 * ppf, gatePosts.mid.y - gatePosts.ny * 0.8 * ppf);

        } else if (gateStyle === 'double_leaf') {
            // Double Leaf Royal Gate: Two 45-degree angled leaves + dashed swing arcs
            const leafLen = (gW / 2) - 0.1 * ppf;
            const leafAngle = Math.atan2(ty, tx);

            // Left Leaf (swinging inward by 45 deg)
            const leftAng = leafAngle - Math.PI / 4;
            const lEnd = { x: gp1.x + Math.cos(leftAng) * leafLen, y: gp1.y + Math.sin(leftAng) * leafLen };

            ctx.beginPath();
            ctx.moveTo(gp1.x, gp1.y);
            ctx.lineTo(lEnd.x, lEnd.y);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Right Leaf
            const rightAng = leafAngle + Math.PI - Math.PI / 4;
            const rEnd = { x: gp2.x + Math.cos(rightAng) * leafLen, y: gp2.y + Math.sin(rightAng) * leafLen };

            ctx.beginPath();
            ctx.moveTo(gp2.x, gp2.y);
            ctx.lineTo(rEnd.x, rEnd.y);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Dashed Swing Arcs
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.arc(gp1.x, gp1.y, leafLen, leafAngle, leftAng, true);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(gp2.x, gp2.y, leafLen, leafAngle + Math.PI, rightAng, false);
            ctx.stroke();

            ctx.font = `bold ${Math.max(8, 9 / state.zoom)}px Inter, sans-serif`;
            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('ROYAL GATE', gatePosts.mid.x - gatePosts.nx * 0.8 * ppf, gatePosts.mid.y - gatePosts.ny * 0.8 * ppf);

        } else {
            // Open Entry: Dashed threshold line
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(gp1.x, gp1.y);
            ctx.lineTo(gp2.x, gp2.y);
            ctx.strokeStyle = '#059669';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = `bold ${Math.max(8, 9 / state.zoom)}px Inter, sans-serif`;
            ctx.fillStyle = '#059669';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('OPEN ENTRY', gatePosts.mid.x, gatePosts.mid.y);
        }
        ctx.restore();
    }
}

function draw2D() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gridScale = 20 * state.zoom;
    canvas.style.backgroundPosition = `${offsetX + state.panX}px ${offsetY + state.panY}px`;
    canvas.style.backgroundSize = `${gridScale}px ${gridScale}px`;

    ctx.save();
    ctx.translate(offsetX + state.panX, offsetY + state.panY);
    ctx.scale(state.zoom, state.zoom);

    if (state.boundaryPolygon.length === 4) {
        const p = state.boundaryPolygon;
        const ppf = state.pixelsPerFoot || 15;
        const roadThick = 45;

        // Outer Compound Wall Boundary (if enabled)
        const isCompound = !!(state.compound && state.compound.enabled);
        const cp = isCompound && typeof getCompoundBoundaryPolygon === 'function' ? getCompoundBoundaryPolygon() : p;

        // Draw Roads (adjacent to outer property boundary cp)
        ctx.fillStyle = '#6b7280';
        if (state.roads.front) ctx.fillRect(cp[0].x - roadThick, cp[0].y, (cp[1].x - cp[0].x) + roadThick * 2, roadThick);
        if (state.roads.back) ctx.fillRect(cp[3].x - roadThick, cp[3].y - roadThick, (cp[2].x - cp[3].x) + roadThick * 2, roadThick);
        if (state.roads.left) ctx.fillRect(cp[3].x - roadThick, cp[3].y, roadThick, (cp[0].y - cp[3].y));
        if (state.roads.right) ctx.fillRect(cp[1].x, cp[2].y, roadThick, (cp[1].y - cp[2].y));

        // If Compound Wall is enabled: Draw Property Yard Plinth & Car Ramp
        if (isCompound) {
            drawCompoundYardAndRamp2D(ctx, cp, p, ppf);
        }

        // Draw Plot Boundary Fill
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
        ctx.closePath();
        let floorFillColor = '#ffffff';
        const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
        const curFloorMatId = (curFloor && curFloor.floorMaterial) || state.floorMaterial;
        if (curFloorMatId && typeof MATERIAL_CATALOG !== 'undefined' && MATERIAL_CATALOG[curFloorMatId]) {
            const def = MATERIAL_CATALOG[curFloorMatId];
            floorFillColor = def.colorHex || '#ffffff';
        }
        ctx.fillStyle = floorFillColor;
        ctx.fill();

        // Draw Assets (Slabs, Stairs, Furniture)
        state.assets.forEach(asset => {
            if (asset.type === 'asset_slab') {
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 2 * state.pixelsPerFoot;
                ctx.lineCap = 'square';
                ctx.beginPath();
                ctx.moveTo(asset.x1, asset.y1);
                ctx.lineTo(asset.x2, asset.y2);
                ctx.stroke();
            } else if (asset.type === 'asset_stair') {
                if (asset.layout || asset.x !== undefined) {
                    drawStaircase2D(asset, false);
                } else {
                    ctx.strokeStyle = asset.subType === 'main' ? '#d97706' : '#64748b';
                    ctx.lineWidth = 3 * state.pixelsPerFoot;
                    ctx.lineCap = 'square';
                    ctx.beginPath();
                    ctx.moveTo(asset.x1, asset.y1);
                    ctx.lineTo(asset.x2, asset.y2);
                    ctx.stroke();

                    const len = Math.hypot(asset.x2 - asset.x1, asset.y2 - asset.y1);
                    const steps = Math.max(1, Math.round(len / ((10 / 12) * state.pixelsPerFoot)));
                    const dx = (asset.x2 - asset.x1) / steps;
                    const dy = (asset.y2 - asset.y1) / steps;
                    const angle = Math.atan2(asset.y2 - asset.y1, asset.x2 - asset.x1);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    for (let i = 1; i < steps; i++) {
                        let sx = asset.x1 + dx * i;
                        let sy = asset.y1 + dy * i;
                        let p1x = sx - Math.sin(angle) * (1.5 * state.pixelsPerFoot);
                        let p1y = sy + Math.cos(angle) * (1.5 * state.pixelsPerFoot);
                        let p2x = sx + Math.sin(angle) * (1.5 * state.pixelsPerFoot);
                        let p2y = sy - Math.cos(angle) * (1.5 * state.pixelsPerFoot);
                        ctx.beginPath();
                        ctx.moveTo(p1x, p1y);
                        ctx.lineTo(p2x, p2y);
                        ctx.stroke();
                    }
                }
            } else if (asset.type.startsWith('furn_')) {
                const angle = Math.atan2(asset.y2 - asset.y1, asset.x2 - asset.x1);
                const len = Math.hypot(asset.x2 - asset.x1, asset.y2 - asset.y1);
                let depth = 2 * state.pixelsPerFoot;

                if (asset.type === 'furn_bed') {
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
                    ctx.strokeStyle = '#0284c7';
                    depth = 6 * state.pixelsPerFoot;
                } else if (asset.type === 'furn_almira') {
                    ctx.fillStyle = 'rgba(161, 98, 7, 0.6)';
                    ctx.strokeStyle = '#713f12';
                    depth = 2 * state.pixelsPerFoot;
                } else if (asset.type === 'furn_sofa') {
                    ctx.fillStyle = 'rgba(236, 72, 153, 0.6)';
                    ctx.strokeStyle = '#be185d';
                    depth = 2.5 * state.pixelsPerFoot;
                } else if (asset.type === 'furn_dining') {
                    ctx.fillStyle = 'rgba(132, 204, 22, 0.6)';
                    ctx.strokeStyle = '#4d7c0f';
                    depth = 3 * state.pixelsPerFoot;
                }

                ctx.save();
                ctx.translate(asset.x1, asset.y1);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.rect(0, 0, len, depth);
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            } else if (asset.type === 'asset_pillar') {
                drawPillar2D(asset, false);
            }
        });

        // Draw Wall Segments (Outer and Partitions) with Architectural Doors & Windows
        const drawSegments = (list) => {
            if (!list || !Array.isArray(list)) return;
            list.forEach(wall => {
                if (!wall) return;
                if (wall.type === 'door') {
                    drawDoor2D(wall);
                } else if (wall.type === 'window') {
                    drawWindow2D(wall);
                } else if (wall.type === 'balcony_wall') {
                    const hVal = wall.heightFt || 3;
                    ctx.save();
                    ctx.lineCap = 'round';
                    // Parapet wall body
                    ctx.beginPath();
                    ctx.moveTo(wall.x1, wall.y1);
                    ctx.lineTo(wall.x2, wall.y2);
                    ctx.strokeStyle = '#0284c7';
                    ctx.lineWidth = 0.45 * state.pixelsPerFoot;
                    ctx.stroke();

                    // Coping cap stone line
                    ctx.beginPath();
                    ctx.moveTo(wall.x1, wall.y1);
                    ctx.lineTo(wall.x2, wall.y2);
                    ctx.strokeStyle = '#e0f2fe';
                    ctx.lineWidth = 0.15 * state.pixelsPerFoot;
                    ctx.stroke();

                    // Text label along wall
                    const midX = (wall.x1 + wall.x2) / 2;
                    const midY = (wall.y1 + wall.y2) / 2;
                    ctx.font = `bold ${Math.max(9, 10 / state.zoom)}px Inter, sans-serif`;
                    ctx.fillStyle = '#0369a1';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(`Balcony (${hVal}ft)`, midX, midY - 3 / state.zoom);
                    ctx.restore();
                } else {
                    ctx.lineCap = 'butt';
                    ctx.beginPath();
                    ctx.moveTo(wall.x1, wall.y1);
                    ctx.lineTo(wall.x2, wall.y2);
                    let wallStroke = '#374151';
                    if (wall.customMaterial && typeof MATERIAL_CATALOG !== 'undefined' && MATERIAL_CATALOG[wall.customMaterial]) {
                        wallStroke = MATERIAL_CATALOG[wall.customMaterial].colorHex || '#374151';
                    }
                    ctx.strokeStyle = wallStroke;
                    ctx.lineWidth = wall.thickness === 'thick' ? 0.75 * state.pixelsPerFoot : 0.5 * state.pixelsPerFoot;
                    ctx.stroke();
                }
            });
        };
        drawSegments(state.outerWalls);
        drawSegments(state.partitions);

        // Draw Exterior Chajjas / Overhangs (Architectural Dashed Projection)
        if (state.chajjas && state.chajjas.length > 0 && state.boundaryPolygon.length === 4) {
            const p = state.boundaryPolygon;
            state.chajjas.forEach(ch => {
                let A, B;
                if (ch.side === 'front') { A = p[0]; B = p[1]; }
                else if (ch.side === 'right') { A = p[1]; B = p[2]; }
                else if (ch.side === 'back') { A = p[2]; B = p[3]; }
                else if (ch.side === 'left') { A = p[3]; B = p[0]; }
                if (!A || !B) return;

                const dx = B.x - A.x, dy = B.y - A.y;
                const len = Math.hypot(dx, dy);
                if (len < 1) return;
                const tx = dx / len, ty = dy / len;
                const nx = -ty, ny = tx;
                const ext = (ch.depth || 3) * state.pixelsPerFoot;

                const p1 = { x: A.x, y: A.y };
                const p2 = { x: B.x, y: B.y };
                const p3 = { x: B.x + nx * ext, y: B.y + ny * ext };
                const p4 = { x: A.x + nx * ext, y: A.y + ny * ext };

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
                ctx.fillStyle = ch.level === 'roof' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(245, 158, 11, 0.18)';
                ctx.fill();

                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = ch.level === 'roof' ? '#2563eb' : '#d97706';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(p4.x, p4.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.moveTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.stroke();

                const midX = (p3.x + p4.x) / 2;
                const midY = (p3.y + p4.y) / 2;
                ctx.setLineDash([]);
                ctx.fillStyle = ch.level === 'roof' ? '#1d4ed8' : '#b45309';
                ctx.font = 'bold 9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const labelText = `Chajja (${ch.depth}' ${ch.level === 'roof' ? 'Roof' : 'Lintel'})`;
                ctx.fillText(labelText, midX, midY);

                ctx.restore();
            });
        }

        // Draw Exterior Compound Wall, Pillars & Main Gate in 2D
        if (isCompound) {
            drawCompoundWall2D(ctx, cp, p, ppf);
        }

        // Draw Placed Ruler Measurements (Pink/Magenta Dashed with Rounded Badge Pills)
        if (state.measurements && state.measurements.length > 0) {
            state.measurements.forEach(m => drawMeasurementLine(m, false));
        }

        // Draw Live Measurement in Progress
        if (isDrawing && state.drawMode === 'measure') {
            drawMeasurementLine({ x1: startX, y1: startY, x2: currentX, y2: currentY }, true);
        }

        // Live Architectural Ghost Preview for Staircase placement in Step 4
        if (state.step === 4 && state.drawMode === 'asset_stair' && !isDrawing) {
            const sSet = state.stairSettings || { layout: 'u_shape', numSteps: 20, flightWidthFt: 3.0, autoCutout: true, rotation: 0, flip: false };
            const ghostStair = createStaircaseAsset(currentX || 0, currentY || 0, sSet.layout || 'u_shape', sSet);
            drawStaircase2D(ghostStair, true);
        }

        // Live Structural Ghost Preview for Pillar / Column in Step 4
        if (state.step === 4 && state.drawMode === 'asset_pillar' && !isDrawing) {
            const snap = getPillarSnapPoint(currentX || 0, currentY || 0);
            const pSet = state.pillarSettings || { shape: 'quad', w: 1.0, d: 2.0, diameter: 1.5, radius: 0.75, rotation: 0 };
            const ghostPillar = createPillarAsset(snap.x, snap.y, pSet);
            drawPillar2D(ghostPillar, true);

            // Snap indicator badge
            ctx.save();
            ctx.beginPath();
            ctx.arc(snap.x, snap.y, 5 / state.zoom, 0, Math.PI * 2);
            ctx.fillStyle = snap.snapped === 'corner' ? '#ef4444' : (snap.snapped === 'wall' ? '#3b82f6' : '#6366f1');
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.stroke();
            ctx.restore();
        }

        // Render Placed MEP Layer (Electrical & Plumbing Layout)
        if (state.showMepLayer || (state.drawMode && state.drawMode.startsWith('mep_'))) {
            const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
            const mepList = (curFloor && curFloor.mepAssets) || state.mepAssets || [];
            drawMepSchematicConnections(mepList);
            mepList.forEach(m => drawMepAsset2D(m, false));
        }

        // Live Ghost Preview for MEP Placement
        if (state.drawMode && state.drawMode.startsWith('mep_') && !isDrawing) {
            drawMepAsset2D({ type: state.drawMode, x: currentX || 0, y: currentY || 0, rotation: 0 }, true);
        }

        // Active Drawing Line & Snap Helpers
        if (state.step === 3 || state.step === 4 || state.step === 5) {
            if (!isDrawing && (state.drawMode === 'door' || state.drawMode === 'window') && state.hoverSnap) {
                ctx.fillStyle = '#eab308';
                ctx.beginPath();
                ctx.arc(state.hoverSnap.projX, state.hoverSnap.projY, 5 / state.zoom, 0, Math.PI * 2);
                ctx.fill();
            }

            if (isDrawing && ['wall', 'balcony_wall', 'door', 'window', 'asset_slab', 'furn_bed', 'furn_almira', 'furn_sofa', 'furn_dining'].includes(state.drawMode)) {
                ctx.strokeStyle = (state.drawMode === 'door') ? '#f59e0b' :
                    ((state.drawMode === 'window') ? '#0ea5e9' :
                    ((state.drawMode === 'balcony_wall') ? '#0284c7' :
                    ((state.drawMode === 'asset_stair') ? '#d97706' : '#ef4444')));

                if (state.drawMode === 'asset_slab') {
                    ctx.lineWidth = 2 * state.pixelsPerFoot;
                } else if (state.drawMode === 'balcony_wall') {
                    ctx.lineWidth = 0.45 * state.pixelsPerFoot;
                } else if (state.drawMode === 'asset_stair') {
                    ctx.lineWidth = 3 * state.pixelsPerFoot;
                } else if (state.drawMode.startsWith('furn_')) {
                    const angle = Math.atan2(currentY - startY, currentX - startX);
                    const len = Math.hypot(currentX - startX, currentY - startY);
                    let depth = 2 * state.pixelsPerFoot;
                    if (state.drawMode === 'furn_bed') depth = 6 * state.pixelsPerFoot;
                    if (state.drawMode === 'furn_sofa') depth = 2.5 * state.pixelsPerFoot;
                    if (state.drawMode === 'furn_dining') depth = 3 * state.pixelsPerFoot;

                    ctx.save();
                    ctx.translate(startX, startY);
                    ctx.rotate(angle);
                    ctx.strokeStyle = '#3b82f6';
                    ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
                    ctx.lineWidth = 1.5 / state.zoom;
                    ctx.strokeRect(0, 0, len, depth);
                    ctx.restore();
                    ctx.setLineDash([]);
                } else {
                    ctx.setLineDash([5 / state.zoom, 5 / state.zoom]);
                    ctx.lineWidth = 2 / state.zoom;
                }

                if (!state.drawMode.startsWith('furn_')) {
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(currentX, currentY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                const lineLen = (Math.hypot(currentX - startX, currentY - startY) / state.pixelsPerFoot).toFixed(1);
                ctx.font = `bold ${11 / state.zoom}px Inter, sans-serif`;
                const w = ctx.measureText(lineLen + ' ft').width + (12 / state.zoom);
                ctx.fillStyle = '#ef4444';
                ctx.fillRect((startX + currentX) / 2 - w / 2, (startY + currentY) / 2 - (25 / state.zoom), w, (20 / state.zoom));
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(lineLen + ' ft', (startX + currentX) / 2, (startY + currentY) / 2 - (15 / state.zoom));
            }
        }
    }

    // Vastu 9-Zone Grid Overlay
    if (state.showVastu && state.boundaryPolygon.length === 4) {
        const p = state.boundaryPolygon;
        const minX = Math.min(p[0].x, p[3].x);
        const maxX = Math.max(p[1].x, p[2].x);
        const minY = Math.min(p[3].y, p[2].y);
        const maxY = Math.max(p[0].y, p[1].y);
        const w = maxX - minX;
        const h = maxY - minY;

        ctx.strokeStyle = 'rgba(147, 51, 234, 0.4)';
        ctx.lineWidth = 2 / state.zoom;
        ctx.setLineDash([6 / state.zoom, 6 / state.zoom]);

        ctx.beginPath(); ctx.moveTo(minX + w / 3, minY); ctx.lineTo(minX + w / 3, maxY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(minX + 2 * w / 3, minY); ctx.lineTo(minX + 2 * w / 3, maxY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(minX, minY + h / 3); ctx.lineTo(maxX, minY + h / 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(minX, minY + 2 * h / 3); ctx.lineTo(maxX, minY + 2 * h / 3); ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(147, 51, 234, 0.7)';
        ctx.font = `bold ${14 / state.zoom}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NW', minX + w / 6, minY + h / 6);
        ctx.fillText('N', minX + w / 2, minY + h / 6);
        ctx.fillText('NE', minX + 5 * w / 6, minY + h / 6);
        ctx.fillText('W', minX + w / 6, minY + h / 2);
        ctx.fillText('Brahma', minX + w / 2, minY + h / 2);
        ctx.fillText('E', minX + 5 * w / 6, minY + h / 2);
        ctx.fillText('SW', minX + w / 6, minY + 5 * h / 6);
        ctx.fillText('S', minX + w / 2, minY + 5 * h / 6);
        ctx.fillText('SE', minX + 5 * w / 6, minY + 5 * h / 6);
    }

    drawRooms();
    if (state.showDimensions) drawStaticDimensions();

    // Continuous Snap Point
    if (state.continuousSnap && (state.step === 3 || state.step === 4)) {
        ctx.beginPath();
        ctx.arc(state.continuousSnap.x, state.continuousSnap.y, 7 / state.zoom, 0, Math.PI * 2);
        ctx.fillStyle = state.continuousSnap.active ? '#1e3a8a' : (state.continuousSnap.hover ? '#3b82f6' : '#9ca3af');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / state.zoom;
        ctx.stroke();
    }

    // Selected Object Highlight Handles
    if (state.selectedObj) {
        const item = state.selectedObj.item;
        ctx.save();
        if (item.type === 'asset_stair') {
            const ppf = state.pixelsPerFoot || 15;
            const cx = item.x !== undefined ? item.x : (item.x1 + item.x2) / 2;
            const cy = item.y !== undefined ? item.y : (item.y1 + item.y2) / 2;
            const w = (item.widthFt || 6.5) * ppf;
            const l = (item.lengthFt || 10.5) * ppf;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
            if (item.flip) ctx.scale(-1, 1);

            // Glowing selection bounding box
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2.5 / state.zoom;
            ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
            ctx.strokeRect(-w / 2 - 4 / state.zoom, -l / 2 - 4 / state.zoom, w + 8 / state.zoom, l + 8 / state.zoom);
            ctx.setLineDash([]);

            // Corner drag handles
            const hw = w / 2 + 4 / state.zoom;
            const hl = l / 2 + 4 / state.zoom;
            const corners = [
                { x: -hw, y: -hl }, { x: hw, y: -hl },
                { x: hw, y: hl }, { x: -hw, y: hl }
            ];
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2 / state.zoom;
            corners.forEach(c => {
                ctx.beginPath();
                ctx.arc(c.x, c.y, 4.5 / state.zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
            ctx.restore();

            updateOverlayPos(cx, cy);
        } else if (item.type === 'asset_pillar') {
            const ppf = state.pixelsPerFoot || 15;
            const cx = item.x;
            const cy = item.y;
            const rotRad = ((item.rotation || 0) * Math.PI) / 180;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotRad);

            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2.5 / state.zoom;
            ctx.setLineDash([5 / state.zoom, 4 / state.zoom]);

            if (item.subType === 'circle') {
                const r = (item.radius || 0.75) * ppf + 4 / state.zoom;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                const hw = ((item.w || 1.0) * ppf) / 2 + 4 / state.zoom;
                const hd = ((item.d || 2.0) * ppf) / 2 + 4 / state.zoom;
                ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);

                const corners = [
                    { x: -hw, y: -hd }, { x: hw, y: -hd },
                    { x: hw, y: hd }, { x: -hw, y: hd }
                ];
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2 / state.zoom;
                corners.forEach(c => {
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, 4 / state.zoom, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                });
            }
            ctx.setLineDash([]);
            ctx.restore();

            updateOverlayPos(cx, cy);
        } else if (item.x1 !== undefined) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 15 / state.zoom;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(item.x1, item.y1);
            ctx.lineTo(item.x2, item.y2);
            ctx.stroke();

            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2.5 / state.zoom;
            ctx.beginPath(); ctx.arc(item.x1, item.y1, 7 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(item.x2, item.y2, 7 / state.zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            updateOverlayPos((item.x1 + item.x2) / 2, (item.y1 + item.y2) / 2);
        } else if (item.x !== undefined) {
            ctx.beginPath();
            ctx.arc(item.x, item.y, 22, 0, Math.PI * 2);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3 / state.zoom;
            ctx.setLineDash([5 / state.zoom, 5 / state.zoom]);
            ctx.stroke();
            updateOverlayPos(item.x, item.y - 25);
        }
        ctx.restore();
    } else {
        const overlay = document.getElementById('edit-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    ctx.restore();
}

// ----------------------------------------------------------------------------
// Edit Overlay & Object Picking
// ----------------------------------------------------------------------------

function updateOverlayPos(cx, cy) {
    const overlay = document.getElementById('edit-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    const screenX = cx * state.zoom + offsetX + state.panX;
    const screenY = cy * state.zoom + offsetY + state.panY;
    overlay.style.left = (screenX - 40) + 'px';
    overlay.style.top = (screenY - 45) + 'px';

    const flipBtn = document.getElementById('btn-flip-swing');
    const flipDiv = document.getElementById('flip-divider');
    const balconyHControl = document.getElementById('balcony-height-control');
    const editBalconyH = document.getElementById('edit-balcony-height');

    if (flipBtn && flipDiv) {
        if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'door') {
            flipBtn.classList.remove('hidden');
            flipDiv.classList.remove('hidden');
        } else {
            flipBtn.classList.add('hidden');
            flipDiv.classList.add('hidden');
        }
    }

    if (balconyHControl) {
        if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'balcony_wall') {
            balconyHControl.classList.remove('hidden');
            if (editBalconyH) editBalconyH.value = String(state.selectedObj.item.heightFt || 3);
        } else {
            balconyHControl.classList.add('hidden');
        }
    }

    const stairControl = document.getElementById('stair-edit-control');
    const stairTitle = document.getElementById('edit-stair-title');
    const stairVoidBtn = document.getElementById('btn-edit-stair-void');

    if (stairControl) {
        if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
            stairControl.classList.remove('hidden');
            const st = state.selectedObj.item;
            const lName = (st.layout || 'u_shape').toUpperCase().replace('_', '-');
            if (stairTitle) stairTitle.innerHTML = `<i class="fa-solid fa-stairs text-amber-600"></i> ${lName}`;
            if (stairVoidBtn) stairVoidBtn.innerText = st.autoCutout !== false ? 'Void: ON' : 'Void: OFF';
        } else {
            stairControl.classList.add('hidden');
        }
    }

    const pillarControl = document.getElementById('pillar-edit-control');
    const pillarTitle = document.getElementById('edit-pillar-title');

    if (pillarControl) {
        if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_pillar') {
            pillarControl.classList.remove('hidden');
            const p = state.selectedObj.item;
            const pName = p.subType === 'circle' ? `Circle (ø${p.diameter || 1.5}')` : `Quad (${p.w || 1}x${p.d || 2}')`;
            if (pillarTitle) pillarTitle.innerHTML = `<i class="fa-solid fa-monument text-indigo-600"></i> ${pName}`;
        } else {
            pillarControl.classList.add('hidden');
        }
    }
}

function toggleDoorSwing() {
    if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'door') {
        saveHistory();
        state.selectedObj.item.swing = (state.selectedObj.item.swing === -1) ? 1 : -1;
        draw2D();
    }
}

function getClickedObject(px, py) {
    // 1. Check Pillars first (using precise oriented footprint)
    for (let i = 0; i < state.assets.length; i++) {
        const a = state.assets[i];
        if (a.type === 'asset_pillar' && isPointInPillar(px, py, a)) {
            return { list: state.assets, index: i, item: a };
        }
    }

    // 2. Check Staircases (using precise oriented footprint)
    for (let i = 0; i < state.assets.length; i++) {
        const a = state.assets[i];
        if (a.type === 'asset_stair' && isPointInStair(px, py, a)) {
            return { list: state.assets, index: i, item: a };
        }
    }

    // 3. Check MEP Assets
    const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
    const mepList = (curFloor && curFloor.mepAssets) || state.mepAssets || [];
    for (let i = 0; i < mepList.length; i++) {
        const m = mepList[i];
        if (isPointInMep(px, py, m)) {
            return { list: mepList, index: i, item: m };
        }
    }

    let bestDist = 15 / state.zoom;
    let bestObj = null;

    state.rooms.forEach((r, i) => {
        if (Math.hypot(r.x - px, r.y - py) < bestDist) {
            bestDist = Math.hypot(r.x - px, r.y - py);
            bestObj = { list: state.rooms, index: i, item: r };
        }
    });
    if (bestObj) return bestObj;

    const checkLines = (list) => {
        list.forEach((w, i) => {
            const res = pointToLineDistance(px, py, w.x1, w.y1, w.x2, w.y2);
            if (res.dist < bestDist) {
                bestDist = res.dist;
                bestObj = { list: list, index: i, item: w };
            }
        });
    };
    checkLines(state.outerWalls);
    checkLines(state.partitions);
    checkLines(state.assets);
    if (state.measurements) checkLines(state.measurements);
    return bestObj;
}

function getHandleClicked(px, py, item) {
    if (item.x1 === undefined) return 'move';
    if (item.type === 'door' || item.type === 'window' || item.type === 'asset_stair' || item.type === 'asset_pillar' || (item.type && item.type.startsWith('mep_'))) return 'move';
    const r = 12 / state.zoom;
    if (Math.hypot(item.x1 - px, item.y1 - py) <= r) return 'start';
    if (Math.hypot(item.x2 - px, item.y2 - py) <= r) return 'end';
    return 'move';
}

function deselectObject() {
    state.selectedObj = null;
    const overlay = document.getElementById('edit-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (state.step !== 6) draw2D();
}

function deleteSelected() {
    if (!state.selectedObj) return;
    saveHistory();
    const item = state.selectedObj.item;
    const arr = state.selectedObj.list;
    if (arr && Array.isArray(arr) && item) {
        const idx = arr.indexOf(item);
        if (idx > -1) arr.splice(idx, 1);
        if (item.type === 'door' || item.type === 'window') {
            healWallAt(item, arr);
        }
    }

    deselectObject();
    if (item && item.type && !item.x1) updateVastuList();
    draw2D();
    if (state.step === 6 && typeof generate3D === 'function') generate3D();
}

function downloadPlan() {
    draw2D();
    const link = document.createElement('a');
    const floorName = (state.floors && state.floors[state.currentFloorIndex]) ? state.floors[state.currentFloorIndex].name : 'Floor';
    link.download = `Smart_Floor_Plan_${floorName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ----------------------------------------------------------------------------
// Canvas Mouse & Keyboard Event Bindings
// ----------------------------------------------------------------------------

function setupBlueprintEvents() {
    if (!canvas) return;

    window.addEventListener('keydown', (e) => {
        if (state.selectedObj && (e.key === 'Delete' || e.key === 'Backspace')) deleteSelected();
        if (e.key === 'r' || e.key === 'R') {
            if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_stair') {
                rotateCurrentStair(90);
            } else if (state.drawMode === 'asset_stair') {
                rotateCurrentStair(90);
            } else if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type === 'asset_pillar') {
                rotateCurrentPillar(90);
            } else if (state.drawMode === 'asset_pillar') {
                rotateCurrentPillar(90);
            } else if (state.selectedObj && state.selectedObj.item && state.selectedObj.item.type && state.selectedObj.item.type.startsWith('mep_')) {
                rotateCurrentMep(90);
            }
        }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
        if (state.step < 3 || state.step > 5) return;
        if (e.button === 2 || e.button === 1) {
            state.isPanning = true;
            state.panStartX = e.clientX - state.panX;
            state.panStartY = e.clientY - state.panY;
            canvas.style.cursor = 'grabbing';
            return;
        }

        const { rawX, rawY } = getMouseCoords(e);

        // Paint Mode: Direct 2D Wall and Floor Painting
        if (state.activeMaterial) {
            const clicked = getClickedObject(rawX, rawY);
            if (clicked && clicked.item) {
                if (clicked.list === state.outerWalls || clicked.list === state.partitions || clicked.item.type === 'wall' || clicked.item.type === 'balcony_wall' || clicked.item.type === 'door' || clicked.item.type === 'window') {
                    if (state.activeMaterial.category !== 'wall') {
                        if (typeof showToast === 'function') showToast('Selected finish is for flooring! Please choose a wall finish.', 'error');
                        return;
                    }
                    clicked.item.customMaterial = state.activeMaterial.id;
                    saveHistory();
                    draw2D();
                    if (state.step === 6 && typeof generate3D === 'function') generate3D();
                    if (typeof showToast === 'function') showToast(`Painted wall with ${state.activeMaterial.name}!`, 'success');
                    return;
                }
            }

            if (pointInPolygon({ x: rawX, y: rawY }, state.boundaryPolygon)) {
                if (state.activeMaterial.category !== 'floor') {
                    if (typeof showToast === 'function') showToast('Selected finish is for walls! Please choose a flooring finish.', 'error');
                    return;
                }
                const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
                if (curFloor) curFloor.floorMaterial = state.activeMaterial.id;
                if (state.currentFloorIndex === 0) {
                    state.floorMaterial = state.activeMaterial.id;
                }
                saveHistory();
                draw2D();
                if (state.step === 6 && typeof generate3D === 'function') generate3D();
                if (typeof showToast === 'function') showToast(`Applied ${state.activeMaterial.name} to floor!`, 'success');
                return;
            }
        }

        if (state.drawMode === 'edit') {
            if (state.selectedObj) {
                const handle = getHandleClicked(rawX, rawY, state.selectedObj.item);
                if (handle) {
                    state.dragState = handle;
                    state.dragStartX = rawX;
                    state.dragStartY = rawY;
                    state.origItem = JSON.parse(JSON.stringify(state.selectedObj.item));
                    state.origList = state.selectedObj.list;
                    saveHistory();
                    return;
                }
            }
            const clicked = getClickedObject(rawX, rawY);
            if (clicked) {
                state.selectedObj = clicked;
                const handle = getHandleClicked(rawX, rawY, state.selectedObj.item);
                if (handle) {
                    state.dragState = handle;
                    state.dragStartX = rawX;
                    state.dragStartY = rawY;
                    state.origItem = JSON.parse(JSON.stringify(state.selectedObj.item));
                    state.origList = state.selectedObj.list;
                    saveHistory();
                }
            } else {
                deselectObject();
            }
            draw2D();
            return;
        }

        if (state.drawMode === 'asset_stair') {
            saveHistory();
            const sSet = state.stairSettings || { layout: 'u_shape', numSteps: 20, flightWidthFt: 3.0, autoCutout: true, rotation: 0, flip: false };
            const newStair = createStaircaseAsset(rawX, rawY, sSet.layout || 'u_shape', sSet);
            state.assets.push(newStair);
            state.selectedObj = { list: state.assets, index: state.assets.length - 1, item: newStair };
            setDrawMode('edit');
            draw2D();
            if (state.step === 6 && typeof generate3D === 'function') generate3D();
            return;
        }

        if (state.drawMode === 'asset_pillar') {
            saveHistory();
            const snap = getPillarSnapPoint(rawX, rawY);
            const pSet = state.pillarSettings || { shape: 'quad', w: 1.0, d: 2.0, diameter: 1.5, radius: 0.75, rotation: 0 };
            const newPillar = createPillarAsset(snap.x, snap.y, pSet);
            state.assets.push(newPillar);
            state.selectedObj = { list: state.assets, index: state.assets.length - 1, item: newPillar };
            setDrawMode('edit');
            draw2D();
            if (state.step === 6 && typeof generate3D === 'function') generate3D();
            return;
        }

        if (state.drawMode && state.drawMode.startsWith('mep_')) {
            saveHistory();
            const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
            if (!curFloor) return;
            if (!curFloor.mepAssets) curFloor.mepAssets = [];

            const newMep = {
                id: 'mep_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                type: state.drawMode,
                x: Math.round(rawX),
                y: Math.round(rawY),
                rotation: 0
            };
            curFloor.mepAssets.push(newMep);
            state.selectedObj = { list: curFloor.mepAssets, index: curFloor.mepAssets.length - 1, item: newMep };
            setDrawMode('edit');
            draw2D();
            if (state.step === 6 && typeof generate3D === 'function') generate3D();
            if (typeof showToast === 'function') {
                showToast(`Placed ${getMepAssetLabel(newMep.type)}. Drag to move, press 'R' to rotate.`, 'success');
            }
            return;
        }

        if (e.shiftKey && state.continuousSnap && ['asset_slab', 'wall'].includes(state.drawMode)) {
            if (Math.hypot(rawX - state.continuousSnap.x, rawY - state.continuousSnap.y) < 20 / state.zoom) {
                state.continuousSnap.active = true;
                startX = state.continuousSnap.x;
                startY = state.continuousSnap.y;
                currentX = startX;
                currentY = startY;
                isDrawing = true;
                draw2D();
                return;
            }
        }

        if (['wall', 'balcony_wall', 'door', 'window', 'asset_slab', 'furn_bed', 'furn_almira', 'furn_sofa', 'furn_dining'].includes(state.drawMode)) {
            startX = rawX;
            startY = rawY;
            currentX = rawX;
            currentY = rawY;
            isDrawing = true;
            if ((state.drawMode === 'door' || state.drawMode === 'window') && state.hoverSnap) {
                startX = state.hoverSnap.projX;
                startY = state.hoverSnap.projY;
                currentX = startX;
                currentY = startY;
                state.activeSnapWall = state.hoverSnap;
            }
        } else if (state.drawMode === 'measure') {
            const snap = getClosestWall(rawX, rawY, 20);
            startX = snap ? snap.projX : rawX;
            startY = snap ? snap.projY : rawY;
            currentX = startX;
            currentY = startY;
            isDrawing = true;
            draw2D();
        } else if (state.drawMode === 'room') {
            saveHistory();
            const type = document.getElementById('room-type').value;
            state.rooms.push({ type, x: rawX, y: rawY, vastuInfo: evaluateVastu(type, rawX, rawY) });
            updateVastuList();
            draw2D();
            if (state.step === 6 && typeof generate3D === 'function') generate3D();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (state.step < 3 || state.step > 5) return;
        if (state.isPanning) {
            state.panX = e.clientX - state.panStartX;
            state.panY = e.clientY - state.panStartY;
            draw2D();
            return;
        }

        const { rawX, rawY } = getMouseCoords(e);

        if (state.activeMaterial) {
            canvas.style.cursor = 'crosshair';
            return;
        }

        if (state.drawMode === 'edit') {
            if (state.dragState && state.selectedObj) {
                let endX = rawX, endY = rawY;
                if (e.shiftKey && (state.dragState === 'start' || state.dragState === 'end')) {
                    const anchorX = state.dragState === 'start' ? state.origItem.x2 : state.origItem.x1;
                    const anchorY = state.dragState === 'start' ? state.origItem.y2 : state.origItem.y1;
                    if (Math.abs(endX - anchorX) > Math.abs(endY - anchorY)) endY = anchorY; else endX = anchorX;
                }
                if (state.dragState === 'start') {
                    state.selectedObj.item.x1 = endX;
                    state.selectedObj.item.y1 = endY;
                } else if (state.dragState === 'end') {
                    state.selectedObj.item.x2 = endX;
                    state.selectedObj.item.y2 = endY;
                } else if (state.dragState === 'move') {
                    let dx = rawX - state.dragStartX;
                    let dy = rawY - state.dragStartY;
                    if (state.selectedObj.item.type === 'asset_pillar') {
                        const ox = state.origItem.x !== undefined ? state.origItem.x : 0;
                        const oy = state.origItem.y !== undefined ? state.origItem.y : 0;
                        const snap = getPillarSnapPoint(ox + dx, oy + dy);
                        state.selectedObj.item.x = Math.round(snap.x);
                        state.selectedObj.item.y = Math.round(snap.y);
                    } else if (state.selectedObj.item.type === 'asset_stair') {
                        const ox = state.origItem.x !== undefined ? state.origItem.x : (state.origItem.x1 + state.origItem.x2) / 2;
                        const oy = state.origItem.y !== undefined ? state.origItem.y : (state.origItem.y1 + state.origItem.y2) / 2;
                        state.selectedObj.item.x = Math.round(ox + dx);
                        state.selectedObj.item.y = Math.round(oy + dy);
                        if (state.origItem.x1 !== undefined) {
                            state.selectedObj.item.x1 = Math.round(state.origItem.x1 + dx);
                            state.selectedObj.item.y1 = Math.round(state.origItem.y1 + dy);
                            state.selectedObj.item.x2 = Math.round(state.origItem.x2 + dx);
                            state.selectedObj.item.y2 = Math.round(state.origItem.y2 + dy);
                        }
                    } else if (state.selectedObj.item.x1 !== undefined) {
                        state.selectedObj.item.x1 = state.origItem.x1 + dx;
                        state.selectedObj.item.y1 = state.origItem.y1 + dy;
                        state.selectedObj.item.x2 = state.origItem.x2 + dx;
                        state.selectedObj.item.y2 = state.origItem.y2 + dy;
                    } else {
                        state.selectedObj.item.x = state.origItem.x + dx;
                        state.selectedObj.item.y = state.origItem.y + dy;
                    }
                }
                draw2D();
            }
            return;
        }

        if (!isDrawing) {
            currentX = rawX;
            currentY = rawY;
            if (!e.shiftKey && state.continuousSnap) state.continuousSnap = null;
            if (state.drawMode === 'door' || state.drawMode === 'window') state.hoverSnap = getClosestWall(rawX, rawY, 20);
            else state.hoverSnap = null;

            if (e.shiftKey && state.continuousSnap && !state.continuousSnap.active) {
                state.continuousSnap.hover = Math.hypot(rawX - state.continuousSnap.x, rawY - state.continuousSnap.y) < 20 / state.zoom;
            }
            draw2D();
            return;
        }

        let endX = rawX, endY = rawY;
        if ((state.drawMode === 'door' || state.drawMode === 'window') && state.activeSnapWall) {
            const proj = pointToLineDistance(rawX, rawY, state.activeSnapWall.wall.x1, state.activeSnapWall.wall.y1, state.activeSnapWall.wall.x2, state.activeSnapWall.wall.y2);
            endX = proj.x;
            endY = proj.y;
        } else if (state.drawMode === 'measure') {
            const snap = getClosestWall(rawX, rawY, 20);
            if (snap) {
                endX = snap.projX;
                endY = snap.projY;
            } else if (e.shiftKey) {
                if (Math.abs(endX - startX) > Math.abs(endY - startY)) endY = startY; else endX = startX;
            }
        } else if (e.shiftKey && ['wall', 'balcony_wall', 'asset_slab', 'asset_stair'].includes(state.drawMode)) {
            if (Math.abs(endX - startX) > Math.abs(endY - startY)) endY = startY; else endX = startX;
        } else if (state.drawMode === 'furn_bed') {
            let angle = Math.atan2(rawY - startY, rawX - startX);
            let forcedFt = document.getElementById('bed-type').value === 'double' ? 6 : 3;
            endX = startX + Math.cos(angle) * (forcedFt * state.pixelsPerFoot);
            endY = startY + Math.sin(angle) * (forcedFt * state.pixelsPerFoot);
        }
        currentX = endX;
        currentY = endY;
        draw2D();
    });

    canvas.addEventListener('mouseup', () => {
        if (state.isPanning) {
            state.isPanning = false;
            canvas.style.cursor = state.drawMode === 'edit' ? 'default' : (state.drawMode === 'room' ? 'pointer' : 'crosshair');
            return;
        }

        if (state.drawMode === 'edit') {
            if (state.dragState && state.selectedObj) {
                const item = state.selectedObj.item;
                const isDoorOrWindow = (item.type === 'door' || item.type === 'window');

                if (isDoorOrWindow && state.origItem) {
                    const distMoved = Math.hypot(item.x1 - state.origItem.x1, item.y1 - state.origItem.y1);
                    if (distMoved < 3) {
                        // Clicked without moving: toggle door swing direction
                        if (item.type === 'door') {
                            item.swing = (item.swing === -1) ? 1 : -1;
                        }
                    } else {
                        // Dragged/moved: dynamically heal the old wall and cleanly cut the new wall
                        const midX = (item.x1 + item.x2) / 2;
                        const midY = (item.y1 + item.y2) / 2;

                        // Remove item from its current list
                        const currentList = state.selectedObj.list;
                        const currIdx = currentList.indexOf(item);
                        if (currIdx > -1) currentList.splice(currIdx, 1);

                        // Heal the wall segments where the door was originally located
                        healWallAt(state.origItem, state.origList);

                        // Find the closest wall at new drop position
                        const snap = getClosestWall(midX, midY, 35);
                        if (snap) {
                            const doorLen = Math.hypot(state.origItem.x2 - state.origItem.x1, state.origItem.y2 - state.origItem.y1);
                            const proj = pointToLineDistance(midX, midY, snap.wall.x1, snap.wall.y1, snap.wall.x2, snap.wall.y2);
                            const wDx = snap.wall.x2 - snap.wall.x1;
                            const wDy = snap.wall.y2 - snap.wall.y1;
                            const wLen = Math.hypot(wDx, wDy);
                            const halfT = (doorLen / 2) / (wLen || 1);
                            let tA = Math.max(0, proj.t - halfT);
                            let tB = Math.min(1, proj.t + halfT);
                            if (tA === 0 && wLen >= doorLen) tB = Math.min(1, doorLen / wLen);
                            if (tB === 1 && wLen >= doorLen) tA = Math.max(0, 1 - (doorLen / wLen));

                            const pA = { x: snap.wall.x1 + tA * wDx, y: snap.wall.y1 + tA * wDy };
                            const pB = { x: snap.wall.x1 + tB * wDx, y: snap.wall.y1 + tB * wDy };

                            const newOpening = splitWallWithOpening(
                                snap.wall,
                                pA,
                                pB,
                                state.origItem.type,
                                state.origItem.subType,
                                snap.list
                            );
                            if (newOpening) {
                                newOpening.swing = state.origItem.swing || 1;
                                state.selectedObj = { list: snap.list, index: snap.list.indexOf(newOpening), item: newOpening };
                            }
                        } else {
                            // Revert if dropped in empty space
                            const revertSnap = getClosestWall((state.origItem.x1 + state.origItem.x2) / 2, (state.origItem.y1 + state.origItem.y2) / 2, 35);
                            if (revertSnap) {
                                const restored = splitWallWithOpening(
                                    revertSnap.wall,
                                    { x: state.origItem.x1, y: state.origItem.y1 },
                                    { x: state.origItem.x2, y: state.origItem.y2 },
                                    state.origItem.type,
                                    state.origItem.subType,
                                    revertSnap.list
                                );
                                if (restored) {
                                    restored.swing = state.origItem.swing || 1;
                                    state.selectedObj = { list: revertSnap.list, index: revertSnap.list.indexOf(restored), item: restored };
                                }
                            } else {
                                state.origList.push(state.origItem);
                                state.selectedObj = { list: state.origList, index: state.origList.indexOf(state.origItem), item: state.origItem };
                            }
                        }
                    }
                }

                state.dragState = null;
                draw2D();
                if (state.selectedObj && state.selectedObj.item.x !== undefined) updateVastuList();
                if (state.step === 6 && typeof generate3D === 'function') generate3D();
            }
            return;
        }

        if (!isDrawing || (state.step < 3 || state.step > 5)) return;
        isDrawing = false;
        const dist = Math.hypot(currentX - startX, currentY - startY);

        if (state.drawMode === 'door' || state.drawMode === 'window') {
            if (state.activeSnapWall && dist > 5) {
                saveHistory();
                const doorSubType = state.drawMode === 'door' ? document.getElementById('door-sub-type').value : null;
                const targetList = state.activeSnapWall.isOuter ? state.outerWalls : state.partitions;

                splitWallWithOpening(
                    state.activeSnapWall.wall,
                    { x: startX, y: startY },
                    { x: currentX, y: currentY },
                    state.drawMode,
                    doorSubType,
                    targetList
                );
            }
            state.activeSnapWall = null;
        } else if (state.drawMode === 'measure') {
            if (dist > 5) {
                saveHistory();
                if (!state.measurements) state.measurements = [];
                const distFt = (dist / state.pixelsPerFoot).toFixed(1);
                state.measurements.push({
                    id: 'meas_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    x1: startX,
                    y1: startY,
                    x2: currentX,
                    y2: currentY,
                    distFt: distFt
                });
            }
        } else if (['wall', 'balcony_wall', 'asset_slab', 'asset_stair', 'furn_bed', 'furn_almira', 'furn_sofa', 'furn_dining'].includes(state.drawMode) && dist > 10) {
            saveHistory();
            if (state.drawMode === 'wall') {
                state.partitions.push({ x1: startX, y1: startY, x2: currentX, y2: currentY, type: 'wall', thickness: 'thin' });
            } else if (state.drawMode === 'balcony_wall') {
                const bHeight = document.getElementById('balcony-height');
                const hVal = bHeight ? (parseFloat(bHeight.value) || 3) : 3;
                state.partitions.push({
                    x1: startX,
                    y1: startY,
                    x2: currentX,
                    y2: currentY,
                    type: 'balcony_wall',
                    heightFt: hVal,
                    thickness: 'thin'
                });
            } else if (state.drawMode === 'asset_slab') {
                state.assets.push({ x1: startX, y1: startY, x2: currentX, y2: currentY, type: 'asset_slab' });
            } else if (state.drawMode === 'asset_stair') {
                const sTypeEl = document.getElementById('stair-sub-type');
                const sType = sTypeEl ? sTypeEl.value : (state.stairSettings ? state.stairSettings.layout : 'u_shape');
                state.assets.push({ x1: startX, y1: startY, x2: currentX, y2: currentY, type: 'asset_stair', subType: sType });
            } else if (state.drawMode.startsWith('furn_')) {
                let sub = null;
                if (state.drawMode === 'furn_bed') {
                    const bEl = document.getElementById('bed-type');
                    sub = bEl ? bEl.value : 'double';
                }
                if (state.drawMode === 'furn_almira') {
                    const aEl = document.getElementById('almira-type');
                    sub = aEl ? aEl.value : 'standard';
                }
                state.assets.push({ x1: startX, y1: startY, x2: currentX, y2: currentY, type: state.drawMode, subType: sub });
            }

            if (e.shiftKey && !state.drawMode.startsWith('furn_')) {
                state.continuousSnap = { x: currentX, y: currentY, active: false, hover: false };
            } else {
                state.continuousSnap = null;
            }
        } else {
            if (e.shiftKey) state.continuousSnap = null;
        }

        draw2D();
        if (state.step === 6 && typeof generate3D === 'function') generate3D();
    });

    canvas.addEventListener('wheel', (e) => {
        if (state.step < 3 || state.step > 5) return;
        e.preventDefault();
        const delta = e.deltaY * 0.001;
        const { rawX, rawY } = getMouseCoords(e);
        let newZoom = Math.max(0.2, Math.min(5, state.zoom - delta));
        state.panX -= rawX * (newZoom - state.zoom);
        state.panY -= rawY * (newZoom - state.zoom);
        state.zoom = newZoom;
        draw2D();
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift' && state.continuousSnap) {
            state.continuousSnap = null;
            draw2D();
        }
    });
}

// Global Exports
window.initBlueprintCanvas = initBlueprintCanvas;
window.resizeCanvas = resizeCanvas;
window.changeZoom = changeZoom;
window.resetZoom = resetZoom;
window.draw2D = draw2D;
window.deselectObject = deselectObject;
window.deleteSelected = deleteSelected;
window.downloadPlan = downloadPlan;
window.toggleDoorSwing = toggleDoorSwing;
window.rotateCurrentMep = rotateCurrentMep;

