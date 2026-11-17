/**
 * ============================================================================
 * step6_view3d.js - Step 6: 3D View, Sun Simulator & Construction Cost Estimator
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Construction Cost & Material Estimator System
// ----------------------------------------------------------------------------
const QUALITY_RATES = {
    standard: {
        name: 'Standard Finish',
        rate: 1600,
        badge: 'Standard',
        desc: 'Standard vitrified tiles, basic fittings, standard grade cement & steel.'
    },
    premium: {
        name: 'Premium Finish',
        rate: 2200,
        badge: 'Premium',
        desc: 'Branded sanitary, modular electricals, premium paint & tiles.'
    },
    luxury: {
        name: 'Luxury Finish',
        rate: 3000,
        badge: 'Luxury',
        desc: 'Italian marble/hardwood, smart fixtures, VRV/VRF ducting, designer woodwork.'
    },
    custom: {
        name: 'Custom Finish',
        rate: 1800,
        badge: 'Custom',
        desc: 'Manually specified construction cost rate per square foot.'
    }
};

function formatINR(val) {
    if (isNaN(val)) return '₹ 0';
    return '₹ ' + Math.round(val).toLocaleString('en-IN');
}

function formatNumberIN(val) {
    if (isNaN(val)) return '0';
    const num = Number(val);
    if (Number.isInteger(num)) {
        return num.toLocaleString('en-IN');
    }
    return num.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function calculateBuiltUpArea() {
    let singleFloorSqFt = 0;
    if (state.plotType === 'proper') {
        const w = (state.dimensions && state.dimensions.w) ? state.dimensions.w : 30;
        const l = (state.dimensions && state.dimensions.l) ? state.dimensions.l : 50;
        singleFloorSqFt = w * l;
    } else {
        if (state.boundaryPolygon && state.boundaryPolygon.length === 4) {
            const p = state.boundaryPolygon;
            const ppf = state.pixelsPerFoot || 15;
            let areaPx2 = 0.5 * Math.abs(
                (p[0].x * p[1].y - p[1].x * p[0].y) +
                (p[1].x * p[2].y - p[2].x * p[1].y) +
                (p[2].x * p[3].y - p[3].x * p[2].y) +
                (p[3].x * p[0].y - p[0].x * p[3].y)
            );
            singleFloorSqFt = areaPx2 / (ppf * ppf);
        } else {
            const t = state.tiltDimensions || { front: 30, back: 32, left: 50, right: 52 };
            const avgW = (t.front + t.back) / 2;
            const avgL = (t.left + t.right) / 2;
            singleFloorSqFt = avgW * avgL;
        }
    }
    const floorCount = (state.floors && state.floors.length) ? state.floors.length : 1;
    const totalArea = Math.round(singleFloorSqFt * floorCount);
    return { singleFloorSqFt: Math.round(singleFloorSqFt), totalArea, floorCount };
}

function updateCostEstimator() {
    const { singleFloorSqFt, totalArea, floorCount } = calculateBuiltUpArea();
    const areaGaj = (totalArea / 9).toFixed(1);
    const tierKey = state.constructionTier || 'standard';
    const tierInfo = QUALITY_RATES[tierKey] || QUALITY_RATES.standard;

    let rate = tierInfo.rate;
    if (tierKey === 'custom') {
        const customInput = document.getElementById('custom-cost-rate');
        const customVal = parseFloat(customInput?.value);
        rate = !isNaN(customVal) ? customVal : (state.customCostRate || 1800);
        QUALITY_RATES.custom.rate = rate;
    }

    const totalCost = totalArea * rate;

    // Component Cost Breakdown
    const costStructure = Math.round(totalCost * 0.50);
    const costFinishing = Math.round(totalCost * 0.30);
    const costServices = Math.round(totalCost * 0.20);

    // Material Estimation Breakdown (per Sq. Ft. of built-up area)
    const cementBags = Math.round(totalArea * 0.4);
    const steelKg = Math.round(totalArea * 3.8);
    const steelTonnes = (steelKg / 1000).toFixed(2);
    const bricksPcs = Math.round(totalArea * 9);
    const sandCuFt = Math.round(totalArea * 1.8);
    const aggregateCuFt = Math.round(totalArea * 1.35);

    // Update UI elements
    const elHeaderTotal = document.getElementById('cost-header-total');
    if (elHeaderTotal) elHeaderTotal.innerText = `${formatINR(totalCost)} (${formatNumberIN(totalArea)} sq.ft)`;

    const elHeaderBadge = document.getElementById('cost-header-badge');
    if (elHeaderBadge) elHeaderBadge.innerText = `${floorCount} ${floorCount === 1 ? 'Floor' : 'Floors'}`;

    const elBadgeTier = document.getElementById('cost-badge-tier');
    if (elBadgeTier) elBadgeTier.innerText = tierInfo.badge;

    const elAreaSqft = document.getElementById('cost-area-sqft');
    if (elAreaSqft) elAreaSqft.innerHTML = `${formatNumberIN(totalArea)} <span class="text-xs font-normal text-gray-500">Sq. Ft.</span>`;

    const elAreaGaj = document.getElementById('cost-area-gaj');
    if (elAreaGaj) elAreaGaj.innerHTML = `${formatNumberIN(areaGaj)} <span class="text-xs font-normal text-gray-500">Gaj</span>`;

    const elRateLabel = document.getElementById('cost-tier-rate-label');
    if (elRateLabel) elRateLabel.innerText = `₹${formatNumberIN(rate)} / sq.ft`;

    const elTierDesc = document.getElementById('cost-tier-desc');
    if (elTierDesc) elTierDesc.innerText = tierInfo.desc;

    const elTotalDisplay = document.getElementById('cost-total-display');
    if (elTotalDisplay) elTotalDisplay.innerText = formatINR(totalCost);

    const elPartStructure = document.getElementById('cost-part-structure');
    if (elPartStructure) elPartStructure.innerText = formatINR(costStructure);

    const elPartFinishing = document.getElementById('cost-part-finishing');
    if (elPartFinishing) elPartFinishing.innerText = formatINR(costFinishing);

    const elPartServices = document.getElementById('cost-part-services');
    if (elPartServices) elPartServices.innerText = formatINR(costServices);

    const elMatCement = document.getElementById('mat-cement');
    if (elMatCement) elMatCement.innerHTML = `${formatNumberIN(cementBags)} <span class="text-[10px] font-normal text-gray-500">Bags</span>`;

    const elMatSteel = document.getElementById('mat-steel');
    if (elMatSteel) elMatSteel.innerHTML = `${formatNumberIN(steelKg)} <span class="text-[10px] font-normal text-gray-500">Kg</span>`;

    const elMatSteelTon = document.getElementById('mat-steel-ton');
    if (elMatSteelTon) elMatSteelTon.innerText = `${steelTonnes} Tonnes (~3.8 kg/sq.ft)`;

    const elMatBricks = document.getElementById('mat-bricks');
    if (elMatBricks) elMatBricks.innerHTML = `${formatNumberIN(bricksPcs)} <span class="text-[10px] font-normal text-gray-500">Pcs</span>`;

    const elMatSand = document.getElementById('mat-sand');
    if (elMatSand) elMatSand.innerHTML = `${formatNumberIN(sandCuFt)} <span class="text-[10px] font-normal text-gray-500">cu.ft</span>`;

    const elMatAggregate = document.getElementById('mat-aggregate');
    if (elMatAggregate) elMatAggregate.innerHTML = `${formatNumberIN(aggregateCuFt)} <span class="text-[10px] font-normal text-gray-500">cu.ft</span>`;
}

function setConstructionTier(tier) {
    if (!QUALITY_RATES[tier]) return;
    state.constructionTier = tier;
    ['standard', 'premium', 'luxury', 'custom'].forEach(t => {
        const btn = document.getElementById(`btn-tier-${t}`);
        if (btn) {
            if (t === tier) {
                btn.className = "tier-btn py-1.5 rounded-md font-bold transition text-[11px] bg-white text-blue-700 shadow-xs border border-gray-200 cursor-pointer";
            } else {
                btn.className = "tier-btn py-1.5 rounded-md font-medium transition text-[11px] text-gray-600 hover:text-blue-600 cursor-pointer";
            }
        }
    });

    const customInput = document.getElementById('custom-cost-rate');
    if (customInput && tier !== 'custom') {
        customInput.value = QUALITY_RATES[tier].rate;
    }

    updateCostEstimator();
}

function onCustomRateInput() {
    const input = document.getElementById('custom-cost-rate');
    const val = parseFloat(input?.value) || 0;
    state.customCostRate = val;
    setConstructionTier('custom');
}

function toggleCostEstimator() {
    const body = document.getElementById('cost-estimator-body');
    const chevron = document.getElementById('cost-toggle-chevron');
    if (!body) return;
    const isHidden = body.classList.contains('hidden');

    if (isHidden) {
        body.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        document.getElementById('cost-estimator-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        body.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(-90deg)';
    }
}

// Global Exports
window.QUALITY_RATES = QUALITY_RATES;
window.formatINR = formatINR;
window.formatNumberIN = formatNumberIN;
window.calculateBuiltUpArea = calculateBuiltUpArea;
window.updateCostEstimator = updateCostEstimator;
window.setConstructionTier = setConstructionTier;
window.onCustomRateInput = onCustomRateInput;
window.toggleCostEstimator = toggleCostEstimator;
