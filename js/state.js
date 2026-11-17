/**
 * ============================================================================
 * state.js - Central State Management, Catalogs, Factories & Geometry Math
 * ============================================================================
 */

// Global Application State Object
const state = {
    step: 1,
    plotType: 'proper',
    dimensions: { w: 30, l: 50 },
    tiltDimensions: { front: 30, back: 32, left: 50, right: 52 },
    roads: { front: true, back: false, left: false, right: false },
    door: 'front',
    boundaryPolygon: [],
    floors: [
        { name: 'Ground', outerWalls: [], partitions: [], rooms: [], assets: [], chajjas: [], measurements: [], mepAssets: [], history: [] }
    ],
    currentFloorIndex: 0,
    constructionTier: 'standard', // 'standard' | 'premium' | 'luxury' | 'custom'
    customCostRate: 1800,
    showRoof: false,
    showMepLayer: false, // Toggleable MEP Layer (Electrical, Plumbing & Sanitary)
    compound: {
        enabled: false,           // Outer compound wall enabled/disabled
        setbacks: {
            front: 5,             // Front setback in ft (default 5 ft)
            back: 3,              // Back setback in ft (0 or 3 ft)
            left: 3,              // Left setback in ft (0 or 3 ft)
            right: 3              // Right setback in ft (0 or 3 ft)
        },
        heightFt: 5.0,            // Wall height slider 4 ft to 7 ft (default 5 ft)
        gateStyle: 'sliding',     // 'sliding' | 'double_leaf' | 'open'
        addRamp: true,            // Add Car Parking Ramp (Slope to Road)
        gateWidthFt: 9.0          // Entrance gate opening width in ft
    },
    drawMode: 'wall',
    showVastu: false,
    showDimensions: true,
    pixelsPerFoot: 15,
    stairSettings: {
        layout: 'u_shape',  // 'u_shape' | 'l_shape' | 'straight'
        numSteps: 20,       // 19, 20, 21 steps for 11 ft height
        flightWidthFt: 3.0, // 3.0, 3.5, 4.0 ft
        autoCutout: true,   // Automatic Roof/Ceiling Cutout (Void)
        flip: false,
        totalHeightFt: 11.0 // 11 ft standard building height
    },
    pillarSettings: {
        shape: 'quad',       // 'quad' | 'circle'
        w: 1.0,              // width in ft (quad)
        d: 2.0,              // depth in ft (quad)
        diameter: 1.5,       // diameter in ft (circle)
        radius: 0.75,        // radius in ft (circle)
        rotation: 0          // 0, 90, 180, 270 deg
    },
    sunSimulation: {
        hour: 12.0,          // 0.0 to 24.0 (12.0 = Noon)
        interiorLightsManual: null // null: auto, true: forced ON, false: forced OFF
    },
    activeMaterial: null, // Currently selected material definition from MATERIAL_CATALOG
    activeSnapWall: null,
    hoverSnap: null,
    continuousSnap: null,
    selectedObj: null,
    dragState: null,
    origItem: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0
};

// ============================================================================
// Custom Wall Paint, Texture & Flooring Material Studio Catalog
// ============================================================================
const MATERIAL_CATALOG = {
    // 1. Wall Finishes
    'wall_warm_ivory': {
        id: 'wall_warm_ivory',
        name: 'Warm Ivory',
        category: 'wall',
        colorHex: '#fdfbf7',
        textureType: null,
        roughness: 0.85,
        metalness: 0.05,
        badge: 'Paint',
        previewStyle: 'background-color: #fdfbf7; border: 1px solid #d1d5db;'
    },
    'wall_royal_blue': {
        id: 'wall_royal_blue',
        name: 'Royal Blue',
        category: 'wall',
        colorHex: '#1e3a8a',
        textureType: null,
        roughness: 0.75,
        metalness: 0.05,
        badge: 'Paint',
        previewStyle: 'background-color: #1e3a8a;'
    },
    'wall_terracotta': {
        id: 'wall_terracotta',
        name: 'Terracotta',
        category: 'wall',
        colorHex: '#c2410c',
        textureType: null,
        roughness: 0.80,
        metalness: 0.05,
        badge: 'Paint',
        previewStyle: 'background-color: #c2410c;'
    },
    'wall_sage_green': {
        id: 'wall_sage_green',
        name: 'Sage Green',
        category: 'wall',
        colorHex: '#4d7c0f',
        textureType: null,
        roughness: 0.80,
        metalness: 0.05,
        badge: 'Paint',
        previewStyle: 'background-color: #4d7c0f;'
    },
    'wall_charcoal_slate': {
        id: 'wall_charcoal_slate',
        name: 'Charcoal Slate',
        category: 'wall',
        colorHex: '#334155',
        textureType: null,
        roughness: 0.70,
        metalness: 0.10,
        badge: 'Paint',
        previewStyle: 'background-color: #334155;'
    },
    'wall_red_brick': {
        id: 'wall_red_brick',
        name: 'Red Brick',
        category: 'wall',
        colorHex: '#b91c1c',
        textureType: 'brick',
        roughness: 0.90,
        metalness: 0.05,
        badge: 'Texture',
        previewStyle: 'background: repeating-linear-gradient(45deg, #b91c1c, #b91c1c 4px, #991b1b 4px, #991b1b 8px);'
    },
    'wall_stone_cladding': {
        id: 'wall_stone_cladding',
        name: 'Stone Cladding',
        category: 'wall',
        colorHex: '#78716c',
        textureType: 'stone',
        roughness: 0.85,
        metalness: 0.05,
        badge: 'Texture',
        previewStyle: 'background: repeating-linear-gradient(45deg, #78716c, #78716c 5px, #57534e 5px, #57534e 10px);'
    },
    'wall_wood_panel': {
        id: 'wall_wood_panel',
        name: 'Wood Panelling',
        category: 'wall',
        colorHex: '#78350f',
        textureType: 'wood_panel',
        roughness: 0.55,
        metalness: 0.05,
        badge: 'Panels',
        previewStyle: 'background: repeating-linear-gradient(90deg, #78350f, #78350f 6px, #451a03 6px, #451a03 8px);'
    },

    // 2. Flooring Finishes
    'floor_italian_marble': {
        id: 'floor_italian_marble',
        name: 'Italian White Marble',
        category: 'floor',
        colorHex: '#f8fafc',
        textureType: 'marble',
        roughness: 0.18,
        metalness: 0.12,
        badge: 'Gloss',
        previewStyle: 'background: linear-gradient(135deg, #ffffff 60%, #cbd5e1 100%); border: 1px solid #cbd5e1;'
    },
    'floor_wooden_parquet': {
        id: 'floor_wooden_parquet',
        name: 'Wooden Parquet',
        category: 'floor',
        colorHex: '#b45309',
        textureType: 'wood',
        roughness: 0.40,
        metalness: 0.05,
        badge: 'Parquet',
        previewStyle: 'background: repeating-linear-gradient(90deg, #b45309, #b45309 5px, #92400e 5px, #92400e 10px);'
    },
    'floor_terracotta_tiles': {
        id: 'floor_terracotta_tiles',
        name: 'Terracotta Tiles',
        category: 'floor',
        colorHex: '#ea580c',
        textureType: 'tile_terracotta',
        roughness: 0.65,
        metalness: 0.02,
        badge: 'Matte',
        previewStyle: 'background: radial-gradient(circle, #ea580c 40%, #c2410c 100%);'
    },
    'floor_vitrified_tiles': {
        id: 'floor_vitrified_tiles',
        name: 'Glossy Vitrified Tiles',
        category: 'floor',
        colorHex: '#ffffff',
        textureType: 'tile_vitrified',
        roughness: 0.10,
        metalness: 0.15,
        badge: 'Mirror',
        previewStyle: 'background: linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #e2e8f0 100%); border: 1px solid #e2e8f0;'
    },
    'floor_bathroom_tiles': {
        id: 'floor_bathroom_tiles',
        name: 'Anti-Skid Bathroom',
        category: 'floor',
        colorHex: '#475569',
        textureType: 'tile_bathroom',
        roughness: 0.85,
        metalness: 0.05,
        badge: 'Anti-Skid',
        previewStyle: 'background: radial-gradient(#64748b 25%, #334155 25%); background-size: 8px 8px;'
    }
};

function showToast(message, type = 'info') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 opacity-0 transform -translate-y-2';
        document.body.appendChild(toast);
    }
    const bgClass = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-red-600' : 'bg-gray-800');
    toast.innerHTML = `<div class="${bgClass} text-white px-4 py-2 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 border border-white/20">
        <i class="fa-solid fa-paintbrush text-amber-300"></i> ${message}
    </div>`;
    toast.classList.remove('opacity-0', '-translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', '-translate-y-2');
    }, 2400);
}

// ============================================================================
// MEP (Mechanical, Electrical, Plumbing & Sanitary) Asset Catalog
// ============================================================================
const MEP_CATALOG = {
    // 1. Electrical Assets
    'mep_ceiling_fan': {
        id: 'mep_ceiling_fan',
        name: 'Ceiling Fan',
        category: 'electrical',
        icon: 'fa-fan',
        color: '#0284c7',
        badge: 'Electrical',
        desc: 'Ceiling mounted 3-blade cooling fan (H: Ceiling - 0.7ft)'
    },
    'mep_wall_ac': {
        id: 'mep_wall_ac',
        name: 'Wall AC Unit',
        category: 'electrical',
        icon: 'fa-snowflake',
        color: '#16a34a',
        badge: 'Electrical',
        desc: 'Split AC indoor cooling unit (H: Wall - 1.8ft)'
    },
    'mep_switchboard': {
        id: 'mep_switchboard',
        name: 'Switchboard',
        category: 'electrical',
        icon: 'fa-toggle-on',
        color: '#ca8a04',
        badge: 'Electrical',
        desc: 'Modular switch panel with MCB/neon (H: 4.0ft)'
    },
    'mep_light_ceiling': {
        id: 'mep_light_ceiling',
        name: 'Ceiling Light / Chandelier',
        category: 'electrical',
        icon: 'fa-lightbulb',
        color: '#eab308',
        badge: 'Electrical',
        desc: 'Ceiling pendant light / chandelier fixture'
    },
    'mep_mcb_box': {
        id: 'mep_mcb_box',
        name: 'Distribution Box (MCB)',
        category: 'electrical',
        icon: 'fa-bolt',
        color: '#ea580c',
        badge: 'Electrical',
        desc: 'Main electrical distribution panel (H: 5.0ft)'
    },

    // 2. Plumbing & Sanitary Assets
    'mep_wc': {
        id: 'mep_wc',
        name: 'Western Toilet (WC)',
        category: 'plumbing',
        icon: 'fa-toilet',
        color: '#0284c7',
        badge: 'Sanitary',
        desc: 'Ceramic commode with dual-flush cistern'
    },
    'mep_wash_basin': {
        id: 'mep_wash_basin',
        name: 'Wash Basin',
        category: 'plumbing',
        icon: 'fa-sink',
        color: '#0891b2',
        badge: 'Sanitary',
        desc: 'Wall-hung ceramic basin with mixer tap (H: 2.8ft)'
    },
    'mep_shower': {
        id: 'mep_shower',
        name: 'Shower Head',
        category: 'plumbing',
        icon: 'fa-shower',
        color: '#06b6d4',
        badge: 'Plumbing',
        desc: 'Wall overhead rain shower & mixer (H: 7.0ft)'
    },
    'mep_drain_trap': {
        id: 'mep_drain_trap',
        name: 'Floor Drain Trap',
        category: 'plumbing',
        icon: 'fa-filter',
        color: '#64748b',
        badge: 'Drainage',
        desc: 'Stainless steel waste water floor trap grate'
    },
    'mep_kitchen_sink': {
        id: 'mep_kitchen_sink',
        name: 'Kitchen Sink',
        category: 'plumbing',
        icon: 'fa-faucet-drip',
        color: '#059669',
        badge: 'Sanitary',
        desc: 'Double bowl stainless sink & gooseneck tap'
    },
    'mep_overhead_tank': {
        id: 'mep_overhead_tank',
        name: 'Overhead Water Tank',
        category: 'plumbing',
        icon: 'fa-database',
        color: '#1e3a8a',
        badge: 'Roof Top',
        desc: '1000L cylindrical Sintex water tank on roof'
    },
    'mep_septic_tank': {
        id: 'mep_septic_tank',
        name: 'Septic / Water Tank',
        category: 'plumbing',
        icon: 'fa-boxes-stacked',
        color: '#475569',
        badge: 'Underground',
        desc: 'Underground chamber with twin manhole covers'
    }
};

function getMepAssetLabel(type) {
    if (typeof MEP_CATALOG !== 'undefined' && MEP_CATALOG[type]) {
        return MEP_CATALOG[type].name;
    }
    return 'MEP Fixture';
}

function getCurrentFloor() {
    if (!state.floors || state.floors.length === 0) {
        state.floors = [{ name: 'Ground', outerWalls: [], partitions: [], rooms: [], assets: [], chajjas: [], measurements: [], mepAssets: [], history: [] }];
        state.currentFloorIndex = 0;
    }
    if (state.currentFloorIndex < 0) state.currentFloorIndex = 0;
    if (state.currentFloorIndex >= state.floors.length) {
        state.currentFloorIndex = state.floors.length - 1;
    }
    const current = state.floors[state.currentFloorIndex];
    if (!current.outerWalls) current.outerWalls = [];
    if (!current.partitions) current.partitions = [];
    if (!current.rooms) current.rooms = [];
    if (!current.assets) current.assets = [];
    if (!current.chajjas) current.chajjas = [];
    if (!current.measurements) current.measurements = [];
    if (!current.mepAssets) current.mepAssets = [];
    if (!current.history) current.history = [];
    return current;
}

Object.defineProperty(state, 'outerWalls', {
    get() { return getCurrentFloor().outerWalls; },
    set(val) { getCurrentFloor().outerWalls = val; }
});
Object.defineProperty(state, 'partitions', {
    get() { return getCurrentFloor().partitions; },
    set(val) { getCurrentFloor().partitions = val; }
});
Object.defineProperty(state, 'rooms', {
    get() { return getCurrentFloor().rooms; },
    set(val) { getCurrentFloor().rooms = val; }
});
Object.defineProperty(state, 'assets', {
    get() { return getCurrentFloor().assets; },
    set(val) { getCurrentFloor().assets = val; }
});
Object.defineProperty(state, 'chajjas', {
    get() { return getCurrentFloor().chajjas; },
    set(val) { getCurrentFloor().chajjas = val; }
});
Object.defineProperty(state, 'measurements', {
    get() { return getCurrentFloor().measurements; },
    set(val) { getCurrentFloor().measurements = val; }
});
Object.defineProperty(state, 'mepAssets', {
    get() { return getCurrentFloor().mepAssets; },
    set(val) { getCurrentFloor().mepAssets = val; }
});
Object.defineProperty(state, 'history', {
    get() { return getCurrentFloor().history; },
    set(val) { getCurrentFloor().history = val; }
});

// ----------------------------------------------------------------------------
// Architectural Staircase Factory (11 ft Height, 19-21 Steps)
// ----------------------------------------------------------------------------
function createStaircaseAsset(cx, cy, layout = 'u_shape', options = {}) {
    const ppf = state.pixelsPerFoot || 15;
    const sSet = state.stairSettings || {};
    const numSteps = options.numSteps || sSet.numSteps || 20;
    const flightWidthFt = options.flightWidthFt || sSet.flightWidthFt || 3.0;
    const totalHeightFt = 11.0;
    const autoCutout = options.autoCutout !== undefined ? options.autoCutout : (sSet.autoCutout !== undefined ? sSet.autoCutout : true);
    const rotation = options.rotation !== undefined ? options.rotation : (sSet.rotation || 0);
    const flip = options.flip !== undefined ? options.flip : (sSet.flip || false);

    let widthFt = 6.5;
    let lengthFt = 10.5;

    if (layout === 'u_shape') {
        const wellGapFt = 0.5;
        widthFt = flightWidthFt * 2 + wellGapFt;
        const treadsPerFlight = Math.max(1, Math.floor(numSteps / 2) - 1);
        const treadFt = 10 / 12; // 10 inches
        lengthFt = 3.0 + treadsPerFlight * treadFt; // 3ft landing + treads
    } else if (layout === 'l_shape') {
        const treadsPerFlight = Math.max(1, Math.floor(numSteps / 2) - 1);
        const treadFt = 10 / 12;
        widthFt = flightWidthFt + treadsPerFlight * treadFt;
        lengthFt = flightWidthFt + treadsPerFlight * treadFt;
    } else { // straight
        widthFt = flightWidthFt;
        lengthFt = (numSteps - 1) * (10 / 12);
    }

    const halfW = (widthFt * ppf) / 2;
    const halfL = (lengthFt * ppf) / 2;

    return {
        id: 'stair_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'asset_stair',
        subType: 'main',
        layout: layout, // 'u_shape' | 'l_shape' | 'straight'
        x: Math.round(cx),
        y: Math.round(cy),
        widthFt: parseFloat(widthFt.toFixed(2)),
        lengthFt: parseFloat(lengthFt.toFixed(2)),
        flightWidthFt: parseFloat(flightWidthFt.toFixed(2)),
        totalHeightFt: totalHeightFt,
        numSteps: numSteps,
        autoCutout: autoCutout,
        rotation: rotation,
        flip: flip,
        x1: Math.round(cx - halfW),
        y1: Math.round(cy - halfL),
        x2: Math.round(cx + halfW),
        y2: Math.round(cy + halfL)
    };
}

// ----------------------------------------------------------------------------
// Structural Pillar / Column Factory (Quad 1x2 ft & Circular)
// ----------------------------------------------------------------------------
function createPillarAsset(cx, cy, options = {}) {
    const pSet = state.pillarSettings || {};
    const shape = options.shape || options.subType || pSet.shape || 'quad'; // 'quad' | 'circle'
    const rotation = options.rotation !== undefined ? options.rotation : (pSet.rotation || 0);

    let w = 1.0;
    let d = 2.0;
    let diameter = 1.5;
    let radius = 0.75;

    if (shape === 'quad') {
        w = options.w !== undefined ? parseFloat(options.w) : (pSet.w || 1.0);
        d = options.d !== undefined ? parseFloat(options.d) : (pSet.d || 2.0);
        diameter = Math.max(w, d);
        radius = parseFloat((Math.min(w, d) / 2).toFixed(3));
    } else {
        diameter = options.diameter !== undefined ? parseFloat(options.diameter) : (pSet.diameter || 1.5);
        radius = parseFloat((diameter / 2).toFixed(3));
        w = diameter;
        d = diameter;
    }

    return {
        id: 'pillar_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'asset_pillar',
        subType: shape, // 'quad' | 'circle'
        x: Math.round(cx),
        y: Math.round(cy),
        w: w,
        d: d,
        diameter: diameter,
        radius: radius,
        rotation: rotation
    };
}

// ----------------------------------------------------------------------------
// Geometry & Distance Math Utilities
// ----------------------------------------------------------------------------
function getDistance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) {
        return { t: 0, x: x1, y: y1, dist: getDistance({ x: px, y: py }, { x: x1, y: y1 }) };
    }
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return { t, x: projX, y: projY, dist: getDistance({ x: px, y: py }, { x: projX, y: projY }) };
}

function getClosestWall(px, py, threshold = 20) {
    const adjustedThreshold = threshold / state.zoom;
    let closest = null;
    let minDist = adjustedThreshold;

    const checkList = (list, isOuter) => {
        for (let i = 0; i < list.length; i++) {
            const w = list[i];
            if (w.type === 'door' || w.type === 'window') continue;
            const res = pointToLineDistance(px, py, w.x1, w.y1, w.x2, w.y2);
            if (res.dist < minDist) {
                minDist = res.dist;
                closest = { wall: w, index: i, list: list, isOuter: isOuter, projX: res.x, projY: res.y, t: res.t };
            }
        }
    };

    checkList(state.outerWalls, true);
    checkList(state.partitions, false);
    return closest;
}

// ----------------------------------------------------------------------------
// Boundary Calculation
// ----------------------------------------------------------------------------
function getCleanOuterWalls() {
    const pts = state.boundaryPolygon;
    if (!pts || pts.length < 4) return [];
    const walls = [];
    for (let i = 0; i < 4; i++) {
        let next = (i + 1) % 4;
        walls.push({
            x1: pts[i].x,
            y1: pts[i].y,
            x2: pts[next].x,
            y2: pts[next].y,
            type: 'outerWall',
            thickness: 'thick'
        });
    }
    return walls;
}

function calculateBoundary() {
    const ppf = state.pixelsPerFoot;
    let pts = [];
    if (state.plotType === 'proper') {
        const w = state.dimensions.w * ppf;
        const l = state.dimensions.l * ppf;
        pts = [
            { x: -w / 2, y: l / 2 },
            { x: w / 2, y: l / 2 },
            { x: w / 2, y: -l / 2 },
            { x: -w / 2, y: -l / 2 }
        ];
    } else {
        const f = state.tiltDimensions.front * ppf;
        const b = state.tiltDimensions.back * ppf;
        const l = state.tiltDimensions.left * ppf;
        const r = state.tiltDimensions.right * ppf;
        pts = [
            { x: -f / 2, y: Math.max(l, r) / 2 },
            { x: f / 2, y: Math.max(l, r) / 2 },
            { x: f / 2 + (b - f) / 2, y: Math.max(l, r) / 2 - r },
            { x: -f / 2 - (b - f) / 2, y: Math.max(l, r) / 2 - l }
        ];
    }
    state.boundaryPolygon = pts;
    const cleanWalls = getCleanOuterWalls();
    if (state.step <= 2) {
        state.floors.forEach(f => {
            f.outerWalls = JSON.parse(JSON.stringify(cleanWalls));
        });
    } else {
        if (!state.outerWalls || state.outerWalls.length === 0) {
            state.outerWalls = JSON.parse(JSON.stringify(cleanWalls));
        }
    }
}

/**
 * Calculates the outer compound wall boundary polygon based on property setbacks.
 * Returns 4 corner points [Front-Left, Front-Right, Back-Right, Back-Left]
 */
function getCompoundBoundaryPolygon() {
    if (!state.boundaryPolygon || state.boundaryPolygon.length !== 4) return null;
    const p = state.boundaryPolygon;
    const ppf = state.pixelsPerFoot || 15;
    const c = state.compound || {};
    const s = c.setbacks || { front: 5, back: 3, left: 3, right: 3 };

    const sFront = (s.front !== undefined ? s.front : 5) * ppf;
    const sBack = (s.back !== undefined ? s.back : 3) * ppf;
    const sLeft = (s.left !== undefined ? s.left : 3) * ppf;
    const sRight = (s.right !== undefined ? s.right : 3) * ppf;

    return [
        { x: p[0].x - sLeft, y: p[0].y + sFront },  // 0: Front-Left
        { x: p[1].x + sRight, y: p[1].y + sFront }, // 1: Front-Right
        { x: p[2].x + sRight, y: p[2].y - sBack },  // 2: Back-Right
        { x: p[3].x - sLeft, y: p[3].y - sBack }   // 3: Back-Left
    ];
}

// ----------------------------------------------------------------------------
// Undo & History Management
// ----------------------------------------------------------------------------
function saveHistory() {
    state.history.push({
        outerWalls: JSON.parse(JSON.stringify(state.outerWalls)),
        partitions: JSON.parse(JSON.stringify(state.partitions)),
        rooms: JSON.parse(JSON.stringify(state.rooms)),
        assets: JSON.parse(JSON.stringify(state.assets)),
        chajjas: JSON.parse(JSON.stringify(state.chajjas || [])),
        measurements: JSON.parse(JSON.stringify(state.measurements || [])),
        mepAssets: JSON.parse(JSON.stringify(state.mepAssets || []))
    });
    if (state.history.length > 15) state.history.shift();
}

function clearPartitions() {
    saveHistory();
    state.partitions = [];
    state.rooms = [];
    state.assets = [];
    state.chajjas = [];
    state.measurements = [];
    state.mepAssets = [];
    state.outerWalls = getCleanOuterWalls();
    if (typeof renderChajjaList === 'function') renderChajjaList();
    if (typeof updateVastuList === 'function') updateVastuList();
    if (typeof draw2D === 'function') draw2D();
    if (state.step === 6 && typeof generate3D === 'function') generate3D();
}

function undoPartition() {
    if (state.history.length > 0) {
        const last = state.history.pop();
        state.outerWalls = last.outerWalls;
        state.partitions = last.partitions;
        state.rooms = last.rooms;
        state.assets = last.assets || [];
        state.chajjas = last.chajjas || [];
        state.measurements = last.measurements || [];
        state.mepAssets = last.mepAssets || [];
        if (typeof renderChajjaList === 'function') renderChajjaList();
        if (typeof updateVastuList === 'function') updateVastuList();
        if (typeof draw2D === 'function') draw2D();
        if (state.step === 6 && typeof generate3D === 'function') generate3D();
    }
}

// Global Exports
window.state = state;
window.MATERIAL_CATALOG = MATERIAL_CATALOG;
window.MEP_CATALOG = MEP_CATALOG;
window.showToast = showToast;
window.getMepAssetLabel = getMepAssetLabel;
window.getCurrentFloor = getCurrentFloor;
window.createStaircaseAsset = createStaircaseAsset;
window.createPillarAsset = createPillarAsset;
window.getDistance = getDistance;
window.pointToLineDistance = pointToLineDistance;
window.getClosestWall = getClosestWall;
window.getCleanOuterWalls = getCleanOuterWalls;
window.calculateBoundary = calculateBoundary;
window.getCompoundBoundaryPolygon = getCompoundBoundaryPolygon;
window.saveHistory = saveHistory;
window.clearPartitions = clearPartitions;
window.undoPartition = undoPartition;
