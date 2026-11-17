/**
 * ============================================================================
 * vastu.js - 9-Zone Vastu Shastra Calculation Engine & AI Floor Plan Designer
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Vastu Shastra Calculation Engine (9 Zones)
// ----------------------------------------------------------------------------
function evaluateVastu(roomType, x, y) {
    const p = state.boundaryPolygon;
    if (!p || p.length < 4) return { text: 'Unknown', color: 'gray' };

    const minX = Math.min(p[0].x, p[3].x);
    const maxX = Math.max(p[1].x, p[2].x);
    const minY = Math.min(p[3].y, p[2].y);
    const maxY = Math.max(p[0].y, p[1].y);
    const w = maxX - minX;
    const h = maxY - minY;

    let col = x < minX + w / 3 ? 'W' : (x > minX + 2 * w / 3 ? 'E' : 'C');
    let row = y < minY + h / 3 ? 'N' : (y > minY + 2 * h / 3 ? 'S' : 'C');
    let zone = row + col;

    if (zone === 'CC') zone = 'Brahmasthan';
    if (zone === 'NC') zone = 'N';
    if (zone === 'SC') zone = 'S';
    if (zone === 'CW') zone = 'W';
    if (zone === 'CE') zone = 'E';

    if (roomType === 'Open Space' || roomType === 'Ventilation') {
        return { text: 'Light & Air Source', color: 'blue' };
    }
    if (roomType === 'Kitchen') {
        if (zone === 'SE') return { text: 'Perfect (Agneya Kon)', color: 'green' };
        if (zone === 'NW' || zone === 'E') return { text: 'Acceptable', color: 'yellow' };
        return { text: 'Avoid in ' + zone, color: 'red' };
    }
    if (roomType.includes('Bedroom')) {
        if (zone === 'SW' && roomType === 'Master Bedroom') return { text: 'Perfect (Nairutya)', color: 'green' };
        if (zone === 'S' || zone === 'W') return { text: 'Good', color: 'yellow' };
        if (zone === 'NW') return { text: 'Good for Guests', color: 'green' };
        return { text: 'Avoid in ' + zone, color: 'red' };
    }
    if (roomType === 'Pooja Room') {
        if (zone === 'NE') return { text: 'Perfect (Ishan)', color: 'green' };
        if (zone === 'E' || zone === 'N') return { text: 'Good', color: 'green' };
        return { text: 'Avoid in ' + zone, color: 'red' };
    }
    if (roomType === 'Bathroom') {
        if (zone === 'NW' || zone === 'W' || zone === 'S') return { text: 'Good Zone', color: 'green' };
        if (zone === 'NE' || zone === 'SW' || zone === 'Brahmasthan') return { text: 'Strictly Avoid', color: 'red' };
        return { text: 'Neutral', color: 'yellow' };
    }
    if (roomType === 'Stairs') {
        if (zone === 'S' || zone === 'W' || zone === 'SW') return { text: 'Perfect for Weight', color: 'green' };
        if (zone === 'NE' || zone === 'Brahmasthan') return { text: 'Strictly Avoid', color: 'red' };
        return { text: 'Acceptable', color: 'yellow' };
    }
    if (roomType === 'Entrance') {
        if (zone === 'N' || zone === 'E' || zone === 'NE') return { text: 'Auspicious Entry', color: 'green' };
        if (zone === 'SW') return { text: 'Avoid Entry Here', color: 'red' };
        return { text: 'Acceptable', color: 'yellow' };
    }
    if (roomType === 'Living Room') {
        if (zone === 'N' || zone === 'E' || zone === 'NE' || zone === 'NW' || zone === 'Brahmasthan') return { text: 'Good Vastu', color: 'green' };
        return { text: 'Acceptable', color: 'yellow' };
    }
    return { text: 'Placed in ' + zone, color: 'gray' };
}

function updateVastuList() {
    const list = document.getElementById('vastu-list');
    if (!list) return;
    if (!state.rooms || state.rooms.length === 0) {
        list.innerHTML = '<li class="text-gray-500 italic">Place rooms or use AI to see scores.</li>';
        return;
    }
    list.innerHTML = state.rooms.map((r, i) => {
        let badge = r.vastuInfo.color === 'green' ? 'bg-green-100 text-green-800' :
            (r.vastuInfo.color === 'red' ? 'bg-red-100 text-red-800' :
                (r.vastuInfo.color === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'));
        return `<li class="flex flex-col p-2 border-b border-gray-100 bg-white rounded shadow-sm relative pr-6">
            <span class="font-bold text-gray-700 text-sm mb-1">${r.type}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium inline-block w-fit ${badge}">${r.vastuInfo.text}</span>
            <button onclick="removeRoom(${i})" class="absolute right-2 top-2 text-gray-400 hover:text-red-500"><i class="fa-solid fa-xmark"></i></button>
        </li>`;
    }).join('');
}

function removeRoom(index) {
    if (typeof saveHistory === 'function') saveHistory();
    state.rooms.splice(index, 1);
    updateVastuList();
    if (typeof draw2D === 'function') draw2D();
    if (state.step === 6 && typeof generate3D === 'function') generate3D();
}

// ----------------------------------------------------------------------------
// Procedural AI Floor Plan Designer
// ----------------------------------------------------------------------------
function generateAILayout() {
    if (typeof saveHistory === 'function') saveHistory();
    state.partitions = [];
    state.rooms = [];
    state.assets = [];
    if (typeof calculateBoundary === 'function') calculateBoundary();

    const ppf = state.pixelsPerFoot || 15;
    const p = state.boundaryPolygon;
    if (!p || p.length < 4) {
        console.warn('Cannot generate AI layout: boundary polygon not ready');
        return;
    }
    const minX = Math.min(p[0].x, p[3].x);
    const maxX = Math.max(p[1].x, p[2].x);
    const minY = Math.min(p[3].y, p[2].y);
    const maxY = Math.max(p[0].y, p[1].y);
    const W = maxX - minX;
    const H = maxY - minY;
    const W_ft = W / ppf;
    const H_ft = H / ppf;

    const doorS = 3 * ppf;
    const mainDoorS = 4 * ppf;
    const winS = 4 * ppf;
    const b = (ft) => ft * ppf;
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    const layoutType = document.getElementById('ai-layout-type')?.value || '2bhk_vastu';

    const addCut = (isVertical, start, end, pos, gapType = null, gapDist = null, gapSize = doorS, gapSubType = 'room') => {
        let x1 = isVertical ? pos : start;
        let y1 = isVertical ? start : pos;
        let x2 = isVertical ? pos : end;
        let y2 = isVertical ? end : pos;

        if (gapType && gapDist !== null) {
            let gx = isVertical ? pos : start + gapDist;
            let gy = isVertical ? start + gapDist : pos;

            if (gapDist - gapSize / 2 > 0.5 * ppf) {
                state.partitions.push({
                    x1: x1, y1: y1,
                    x2: isVertical ? pos : gx - gapSize / 2,
                    y2: isVertical ? gy - gapSize / 2 : pos,
                    type: 'wall', thickness: 'thin'
                });
            }
            state.partitions.push({
                x1: isVertical ? pos : gx - gapSize / 2,
                y1: isVertical ? gy - gapSize / 2 : pos,
                x2: isVertical ? pos : gx + gapSize / 2,
                y2: isVertical ? gy + gapSize / 2 : pos,
                type: gapType, subType: gapSubType, thickness: 'thin'
            });
            let rem = (end - start) - (gapDist + gapSize / 2);
            if (rem > 0.5 * ppf) {
                state.partitions.push({
                    x1: isVertical ? pos : gx + gapSize / 2,
                    y1: isVertical ? gy + gapSize / 2 : pos,
                    x2: x2, y2: y2,
                    type: 'wall', thickness: 'thin'
                });
            }
        } else {
            state.partitions.push({ x1, y1, x2, y2, type: 'wall', thickness: 'thin' });
        }
    };

    const addRoom = (type, rx, ry) => {
        state.rooms.push({ type, x: rx, y: ry, vastuInfo: evaluateVastu(type, rx, ry) });
    };

    state.outerWalls = [];
    let doorPos = clamp(rand(4, Math.floor(W_ft / 2)), 4, W_ft - 5) * ppf;
    let winPos = maxX - clamp(rand(4, 8), 3, W_ft - 5) * ppf;

    state.outerWalls.push({ x1: minX, y1: maxY, x2: minX + doorPos - mainDoorS / 2, y2: maxY, type: 'outerWall', thickness: 'thick' });
    state.partitions.push({ x1: minX + doorPos - mainDoorS / 2, y1: maxY, x2: minX + doorPos + mainDoorS / 2, y2: maxY, type: 'door', subType: 'entrance', thickness: 'thick' });
    state.outerWalls.push({ x1: minX + doorPos + mainDoorS / 2, y1: maxY, x2: winPos - winS / 2, y2: maxY, type: 'outerWall', thickness: 'thick' });
    state.partitions.push({ x1: winPos - winS / 2, y1: maxY, x2: winPos + winS / 2, y2: maxY, type: 'window', thickness: 'thick' });
    state.outerWalls.push({ x1: winPos + winS / 2, y1: maxY, x2: maxX, y2: maxY, type: 'outerWall', thickness: 'thick' });

    state.outerWalls.push({ x1: maxX, y1: maxY, x2: maxX, y2: minY, type: 'outerWall', thickness: 'thick' });
    let backWinPos = minX + W / 2;
    state.outerWalls.push({ x1: maxX, y1: minY, x2: backWinPos + winS / 2, y2: minY, type: 'outerWall', thickness: 'thick' });
    state.partitions.push({ x1: backWinPos + winS / 2, y1: minY, x2: backWinPos - winS / 2, y2: minY, type: 'window', thickness: 'thick' });
    state.outerWalls.push({ x1: backWinPos - winS / 2, y1: minY, x2: minX, y2: minY, type: 'outerWall', thickness: 'thick' });
    state.outerWalls.push({ x1: minX, y1: minY, x2: minX, y2: maxY, type: 'outerWall', thickness: 'thick' });

    let bed_l = clamp(rand(10, 14), 8, H_ft * 0.4);
    let bed_w = clamp(rand(10, 13), 8, W_ft * 0.4);
    let bath_w = clamp(rand(5, 7), 4, W_ft * 0.25);
    let kit_l = clamp(rand(8, 12), 6, H_ft * 0.3);
    let kit_w = clamp(rand(8, 10), 6, W_ft * 0.4);

    if (layoutType === '1bhk') {
        let y_cut = minY + b(bed_l);
        addCut(false, minX, maxX, y_cut, 'door', b(bed_w) - b(2));
        addCut(true, minY, y_cut, minX + b(bed_w), 'door', b(bed_l / 2));

        let x_kit = maxX - b(kit_w);
        let y_kit = y_cut + b(kit_l);
        addCut(false, x_kit, maxX, y_kit, 'door', b(kit_w / 2));
        addCut(true, y_cut, y_kit, x_kit);

        addRoom('Master Bedroom', minX + b(bed_w / 2), minY + b(bed_l / 2));
        addRoom('Bathroom', minX + b(bed_w) + b(bath_w / 2), minY + b(bed_l / 2));
        addRoom('Kitchen', maxX - b(kit_w / 2), y_cut + b(kit_l / 2));
        addRoom('Living Room', minX + b(W_ft / 3), y_cut + b((H_ft - bed_l) / 2));
        state.assets.push({ x1: x_kit + b(1), y1: y_cut + b(1), x2: maxX - b(1), y2: y_cut + b(1), type: 'asset_slab' });
    } else if (layoutType === '2bhk_vastu' || layoutType === 'auto') {
        let y_cut = minY + b(bed_l);
        addCut(false, minX, maxX, y_cut, 'door', b(3));
        let x_cut1 = minX + b(bed_w);
        addCut(true, minY, y_cut, x_cut1, 'door', b(3));
        let x_cut2 = x_cut1 + b(bath_w);
        addCut(true, minY, y_cut, x_cut2, 'door', b(3));

        let y_kit = maxY - b(kit_l);
        let x_kit = maxX - b(kit_w);
        addCut(false, x_kit, maxX, y_kit, 'door', b(kit_w / 2));
        addCut(true, y_kit, maxY, x_kit);

        addRoom('Master Bedroom', minX + b(bed_w / 2), minY + b(bed_l / 2));
        addRoom('Bathroom', x_cut1 + b(bath_w / 2), minY + b(bed_l / 2));
        addRoom('Bedroom', x_cut2 + b((W_ft - bed_w - bath_w) / 2), minY + b(bed_l / 2));
        addRoom('Kitchen', maxX - b(kit_w / 2), maxY - b(kit_l / 2));
        addRoom('Living Room', minX + b(bed_w / 2), y_cut + b((H_ft - bed_l) / 2));
    } else if (layoutType === '3bhk') {
        let y_cut1 = minY + b(bed_l);
        addCut(false, minX, maxX, y_cut1, 'door', b(W_ft / 2));
        addCut(true, minY, y_cut1, minX + b(bed_w), 'door', b(3));
        addCut(true, minY, y_cut1, minX + b(bed_w) + b(bath_w), 'door', b(3));

        let y_cut2 = maxY - b(bed_l);
        addCut(false, minX, maxX, y_cut2, 'door', b(W_ft / 2));
        addCut(true, y_cut2, maxY, minX + b(bed_w), 'door', b(3));

        let x_kit = maxX - b(kit_w);
        addCut(true, y_cut1, y_cut2, x_kit, 'door', b(3));

        addRoom('Master Bedroom', minX + b(bed_w / 2), minY + b(bed_l / 2));
        addRoom('Bathroom', minX + b(bed_w) + b(bath_w / 2), minY + b(bed_l / 2));
        addRoom('Bedroom', maxX - b(bed_w / 2), minY + b(bed_l / 2));
        addRoom('Bedroom', minX + b(bed_w / 2), maxY - b(bed_l / 2));
        addRoom('Kitchen', maxX - b(kit_w / 2), y_cut1 + b((y_cut2 - y_cut1) / 2));
        addRoom('Living Room', minX + b(W_ft / 2), y_cut1 + b((y_cut2 - y_cut1) / 2));
    }

    updateVastuList();
    if (typeof draw2D === 'function') draw2D();
    if (state.step === 6 && typeof generate3D === 'function') generate3D();
}

// Global Exports
window.evaluateVastu = evaluateVastu;
window.updateVastuList = updateVastuList;
window.removeRoom = removeRoom;
window.generateAILayout = generateAILayout;
