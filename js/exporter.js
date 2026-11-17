/**
 * ============================================================================
 * exporter.js - Project Persistence & Pure Quad-Mesh Exporter (OBJ & ASCII FBX 7.4)
 * ============================================================================
 * Strict Quad Topology Engine (No Triangulation / Zero Diagonals):
 * - Cuboid/box elements exported with exactly 8 vertices and 6 Quad faces (4 vertices/face)
 * - Pure Quad Wavefront OBJ exporter (f v1 v2 v3 v4)
 * - Pure ASCII FBX 7.4 exporter with PolygonVertexIndex 4-index loops (i0, i1, i2, ~i3)
 * - Complete state serialization/deserialization for SmartHome_Project.json
 */

// ----------------------------------------------------------------------------
// 1. Project Persistence System (Save / Load .json)
// ----------------------------------------------------------------------------

function saveProjectJSON() {
    try {
        const projectData = {
            version: "1.0",
            appName: "SmartHome Digital Vastu",
            timestamp: new Date().toISOString(),
            plotType: state.plotType || 'proper',
            dimensions: Object.assign({}, state.dimensions || { w: 30, l: 50 }),
            tiltDimensions: Object.assign({}, state.tiltDimensions || { front: 30, back: 32, left: 50, right: 52 }),
            roads: Object.assign({}, state.roads || { front: true, back: false, left: false, right: false }),
            door: state.door || 'front',
            constructionTier: state.constructionTier || 'standard',
            customCostRate: state.customCostRate || 1800,
            showRoof: !!state.showRoof,
            showVastu: !!state.showVastu,
            showDimensions: state.showDimensions !== false,
            stairSettings: Object.assign({}, state.stairSettings || {
                layout: 'u_shape',
                numSteps: 20,
                flightWidthFt: 3.0,
                autoCutout: true,
                flip: false,
                totalHeightFt: 11.0
            }),
            pillarSettings: Object.assign({}, state.pillarSettings || {
                shape: 'quad',
                w: 1.0,
                d: 2.0,
                diameter: 1.5,
                radius: 0.75,
                rotation: 0
            }),
            sunSimulation: Object.assign({}, state.sunSimulation || {
                hour: 12.0,
                interiorLightsManual: null
            }),
            compound: JSON.parse(JSON.stringify(state.compound || {})),
            floors: JSON.parse(JSON.stringify(state.floors || [])),
            currentFloorIndex: state.currentFloorIndex || 0
        };

        const jsonStr = JSON.stringify(projectData, null, 2);
        downloadFile(jsonStr, "SmartHome_Project.json", "application/json");
    } catch (err) {
        console.error("Error saving project JSON:", err);
        alert("Failed to save project: " + err.message);
    }
}

function loadProjectJSON(event) {
    const file = event.target && event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data) throw new Error("File content is empty or invalid JSON.");

            // 1. Restore Global State Properties
            if (data.plotType) state.plotType = data.plotType;
            if (data.dimensions) state.dimensions = Object.assign({}, data.dimensions);
            if (data.tiltDimensions) state.tiltDimensions = Object.assign({}, data.tiltDimensions);
            if (data.roads) state.roads = Object.assign({}, data.roads);
            if (data.door) state.door = data.door;
            if (data.constructionTier) state.constructionTier = data.constructionTier;
            if (data.customCostRate !== undefined) state.customCostRate = data.customCostRate;
            if (data.showRoof !== undefined) state.showRoof = !!data.showRoof;
            if (data.showVastu !== undefined) state.showVastu = !!data.showVastu;
            if (data.showDimensions !== undefined) state.showDimensions = !!data.showDimensions;
            if (data.stairSettings) state.stairSettings = Object.assign({}, data.stairSettings);
            if (data.pillarSettings) state.pillarSettings = Object.assign({}, data.pillarSettings);
            if (data.sunSimulation) {
                state.sunSimulation = Object.assign({}, data.sunSimulation);
                if (typeof updateSunSimulation === 'function') {
                    updateSunSimulation(state.sunSimulation.hour !== undefined ? state.sunSimulation.hour : 12.0);
                }
            }
            if (data.compound) state.compound = Object.assign({}, data.compound);

            // 2. Restore Multi-Floor Array
            if (Array.isArray(data.floors) && data.floors.length > 0) {
                state.floors = data.floors;
                state.currentFloorIndex = Math.min(data.currentFloorIndex || 0, state.floors.length - 1);
            }

            // 3. Synchronize All UI Inputs Across Steps
            syncUIFromState();

            // 4. Trigger Full Architectural Recalculation & Re-renders
            if (typeof calculateBoundary === 'function') calculateBoundary();
            if (typeof renderFloorButtons === 'function') renderFloorButtons();
            if (typeof renderChajjaList === 'function') renderChajjaList();
            if (typeof updateVastuList === 'function') updateVastuList();
            if (typeof updateCostEstimator === 'function') updateCostEstimator();
            if (typeof draw2D === 'function') draw2D();
            if (typeof generate3D === 'function') generate3D();

            alert("Project successfully loaded!");
        } catch (err) {
            console.error("Error loading project JSON:", err);
            alert("Failed to load project: " + err.message);
        }
    };
    reader.readAsText(file);
    // Reset file input so user can re-upload same file if desired
    event.target.value = '';
}

function syncUIFromState() {
    // Plot Dimensions
    const pw = document.getElementById('plot-width');
    const pl = document.getElementById('plot-length');
    if (pw && state.dimensions) pw.value = state.dimensions.w;
    if (pl && state.dimensions) pl.value = state.dimensions.l;

    // Tilt Dimensions
    const tf = document.getElementById('tilt-front');
    const tb = document.getElementById('tilt-back');
    const tl = document.getElementById('tilt-left');
    const tr = document.getElementById('tilt-right');
    if (tf && state.tiltDimensions) tf.value = state.tiltDimensions.front;
    if (tb && state.tiltDimensions) tb.value = state.tiltDimensions.back;
    if (tl && state.tiltDimensions) tl.value = state.tiltDimensions.left;
    if (tr && state.tiltDimensions) tr.value = state.tiltDimensions.right;

    // Roads Checkboxes
    ['front', 'back', 'left', 'right'].forEach(side => {
        const chk = document.getElementById(`road-${side}`);
        if (chk && state.roads) chk.checked = !!state.roads[side];
    });

    // Main Door Direction
    const doorSel = document.getElementById('door-direction');
    if (doorSel && state.door) doorSel.value = state.door;

    // Plot Type (Proper vs Tilt)
    if (typeof setPlotType === 'function') setPlotType(state.plotType || 'proper');

    // Toggles
    const vastuChk = document.getElementById('vastu-toggle');
    if (vastuChk) vastuChk.checked = !!state.showVastu;

    const dimChk = document.getElementById('dimensions-toggle');
    if (dimChk) dimChk.checked = !!state.showDimensions;

    // Stair Settings UI
    if (state.stairSettings) {
        if (typeof selectStairLayout === 'function') selectStairLayout(state.stairSettings.layout || 'u_shape');
        if (typeof setStairSteps === 'function') setStairSteps(state.stairSettings.numSteps || 20);
        const stairCutout = document.getElementById('stair-auto-cutout');
        if (stairCutout) stairCutout.checked = state.stairSettings.autoCutout !== false;
        const stairFw = document.getElementById('stair-flight-width');
        if (stairFw) stairFw.value = String(state.stairSettings.flightWidthFt || 3.0);
    }

    // Pillar Settings UI
    if (state.pillarSettings) {
        if (typeof selectPillarShape === 'function') selectPillarShape(state.pillarSettings.shape || 'quad');
        const qSize = document.getElementById('pillar-quad-size');
        if (qSize && state.pillarSettings.w && state.pillarSettings.d) {
            qSize.value = `${state.pillarSettings.w}x${state.pillarSettings.d}`;
        }
        if (typeof changePillarDiameter === 'function') changePillarDiameter(state.pillarSettings.diameter || 1.5);
    }

    // Roof Toggle Button
    const btnRoof = document.getElementById('btn-toggle-roof');
    if (btnRoof) {
        if (state.showRoof) {
            btnRoof.classList.add('bg-blue-100', 'text-blue-700');
            btnRoof.classList.remove('bg-white', 'text-gray-700');
        } else {
            btnRoof.classList.remove('bg-blue-100', 'text-blue-700');
            btnRoof.classList.add('bg-white', 'text-gray-700');
        }
    }

    // Compound Wall Controls
    if (state.compound) {
        const cChk = document.getElementById('compound-wall-enable');
        if (cChk) cChk.checked = !!state.compound.enabled;
        const cContainer = document.getElementById('compound-settings-container');
        if (cContainer) {
            if (state.compound.enabled) cContainer.classList.remove('hidden');
            else cContainer.classList.add('hidden');
        }
        if (state.compound.setbacks) {
            const sF = document.getElementById('compound-setback-front');
            const sB = document.getElementById('compound-setback-back');
            const sL = document.getElementById('compound-setback-left');
            const sR = document.getElementById('compound-setback-right');
            if (sF && state.compound.setbacks.front !== undefined) sF.value = state.compound.setbacks.front;
            if (sB && state.compound.setbacks.back !== undefined) sB.value = state.compound.setbacks.back;
            if (sL && state.compound.setbacks.left !== undefined) sL.value = state.compound.setbacks.left;
            if (sR && state.compound.setbacks.right !== undefined) sR.value = state.compound.setbacks.right;
        }
        const hSlider = document.getElementById('compound-wall-height');
        const hVal = document.getElementById('compound-height-val');
        if (hSlider && state.compound.heightFt !== undefined) {
            hSlider.value = state.compound.heightFt;
            if (hVal) hVal.innerText = state.compound.heightFt.toFixed(1) + ' ft';
        }
        const gStyle = document.getElementById('compound-gate-style');
        if (gStyle && state.compound.gateStyle) gStyle.value = state.compound.gateStyle;
        const rChk = document.getElementById('compound-ramp-enable');
        if (rChk && state.compound.addRamp !== undefined) rChk.checked = !!state.compound.addRamp;
    }
}

// ----------------------------------------------------------------------------
// 2. Pure Quad Mesh Exporter Engine (Untriangulated 4-Vertex Polygons)
// ----------------------------------------------------------------------------

/**
 * Reconstructs every 3D architectural element into pure 4-vertex Quads.
 * Every cuboid/box has exactly 8 vertices and 6 quad faces (never 12 triangles).
 * Slabs are quad-meshed with 8 vertices and 6 quads per sub-slab.
 */
function collectQuadMeshes() {
    const quadMeshes = [];
    const scale = 0.5;
    const ppf3D = (state.pixelsPerFoot || 15) * scale;
    const scaleToFeet = 1 / ppf3D; // Standard 1 unit = 1 real-world foot

    function addCuboid(name, floorName, width, height, depth, matrixWorld) {
        const hw = width / 2;
        const hh = height / 2;
        const hd = depth / 2;

        // Exactly 8 corner vertices in local space
        const localVerts = [
            new THREE.Vector3(-hw, -hh, -hd), // 0: ---
            new THREE.Vector3( hw, -hh, -hd), // 1: +--
            new THREE.Vector3( hw,  hh, -hd), // 2: ++-
            new THREE.Vector3(-hw,  hh, -hd), // 3: -+-
            new THREE.Vector3(-hw, -hh,  hd), // 4: --+
            new THREE.Vector3( hw, -hh,  hd), // 5: +-+
            new THREE.Vector3( hw,  hh,  hd), // 6: +++
            new THREE.Vector3(-hw,  hh,  hd)  // 7: -++
        ];

        // Transform to global coordinates and convert to real-world feet
        const worldVerts = localVerts.map(v => {
            const wv = v.clone().applyMatrix4(matrixWorld);
            return new THREE.Vector3(
                wv.x * scaleToFeet,
                wv.y * scaleToFeet,
                wv.z * scaleToFeet
            );
        });

        // Exactly 6 Quad faces (counter-clockwise outward winding)
        let faces = [
            [4, 5, 6, 7], // Front (+Z)
            [1, 0, 3, 2], // Back (-Z)
            [3, 7, 6, 2], // Top (+Y)
            [0, 1, 5, 4], // Bottom (-Y)
            [1, 2, 6, 5], // Right (+X)
            [0, 4, 7, 3]  // Left (-X)
        ];

        // Handle reflection/flip matrix determinant
        if (matrixWorld.determinant() < 0) {
            faces = faces.map(f => [f[0], f[3], f[2], f[1]]);
        }

        quadMeshes.push({
            name: name,
            floor: floorName,
            vertices: worldVerts,
            faces: faces
        });
    }

    function addQuadCylinder(name, floorName, radius, height, radialSegments = 16, matrixWorld) {
        const segs = radialSegments;
        const hh = height / 2;
        const localVerts = [];

        // Bottom circle (indices 0 to segs - 1)
        for (let i = 0; i < segs; i++) {
            const theta = (i / segs) * Math.PI * 2;
            localVerts.push(new THREE.Vector3(radius * Math.cos(theta), -hh, radius * Math.sin(theta)));
        }
        // Top circle (indices segs to 2*segs - 1)
        for (let i = 0; i < segs; i++) {
            const theta = (i / segs) * Math.PI * 2;
            localVerts.push(new THREE.Vector3(radius * Math.cos(theta), hh, radius * Math.sin(theta)));
        }

        const worldVerts = localVerts.map(v => {
            const wv = v.clone().applyMatrix4(matrixWorld);
            return new THREE.Vector3(
                wv.x * scaleToFeet,
                wv.y * scaleToFeet,
                wv.z * scaleToFeet
            );
        });

        const faces = [];
        // 1. Vertical Side Quad Faces
        for (let i = 0; i < segs; i++) {
            const next = (i + 1) % segs;
            faces.push([i, next, segs + next, segs + i]);
        }
        // 2. Top and Bottom Caps partitioned into Quad Strips
        const halfSegs = segs / 2;
        for (let k = 0; k < halfSegs - 1; k++) {
            const i1 = (segs - 1 - k);
            const i2 = k;
            const i3 = k + 1;
            const i4 = (segs - 2 - k);
            // Bottom cap quad
            faces.push([i1, i4, i3, i2]);
            // Top cap quad
            faces.push([segs + i1, segs + i2, segs + i3, segs + i4]);
        }

        quadMeshes.push({
            name: name,
            floor: floorName,
            vertices: worldVerts,
            faces: faces
        });
    }

    if (houseGroup) {
        houseGroup.updateMatrixWorld(true);

        let floorIndex = 0;
        houseGroup.children.forEach(child => {
            // Check if floorGroup
            if (child.isGroup) {
                const floorName = (state.floors && state.floors[floorIndex])
                    ? `Floor_${floorIndex}_${state.floors[floorIndex].name || 'Level'}`
                    : `Floor_${floorIndex}`;
                let partCounter = 1;

                child.traverse(node => {
                    if (node.isMesh && node.geometry && node.geometry.type === 'BoxGeometry') {
                        node.updateMatrixWorld(true);
                        const params = node.geometry.parameters;
                        if (params) {
                            let objName = node.name || '';
                            if (!objName) {
                                const type = (node.userData && node.userData.type) || 'Element';
                                objName = `${type}_${partCounter++}`;
                            }
                            addCuboid(objName, floorName, params.width, params.height, params.depth, node.matrixWorld);
                        }
                    } else if (node.isMesh && node.geometry && node.geometry.type === 'CylinderGeometry') {
                        node.updateMatrixWorld(true);
                        const params = node.geometry.parameters;
                        if (params) {
                            if (node.userData && node.userData.type === 'asset_pillar') {
                                const r = params.radiusTop || 0.75 * ppf3D;
                                const h = params.height || 11 * ppf3D;
                                const segs = params.radialSegments || 16;
                                const objName = `Pillar_Circle_${partCounter++}`;
                                addQuadCylinder(objName, floorName, r, h, segs, node.matrixWorld);
                            } else {
                                // Railing posts & handrails: export as 4-sided square bar cuboids
                                const r = params.radiusTop || 0.06 * ppf3D;
                                const h = params.height || 10;
                                const objName = `Railing_${partCounter++}`;
                                addCuboid(objName, floorName, r * 2, h, r * 2, node.matrixWorld);
                            }
                        }
                    }
                });

                floorIndex++;
            } else if (child.isMesh && child.geometry) {
                // Plinth slab, Roof slab, or Road
                child.updateMatrixWorld(true);
                if (child.geometry.type === 'BoxGeometry') {
                    const params = child.geometry.parameters;
                    if (params) {
                        const objName = child.name || 'Site_Road';
                        addCuboid(objName, 'Site_Ground', params.width, params.height, params.depth, child.matrixWorld);
                    }
                } else if (child.geometry.type === 'ExtrudeGeometry') {
                    if (state.boundaryPolygon && state.boundaryPolygon.length === 4) {
                        const p = state.boundaryPolygon;
                        const slabThickness = 0.75 * ppf3D;
                        const isRoof = child.position.y > 5;
                        const slabY = child.position.y;
                        const slabName = isRoof ? 'Roof_Slab' : 'Plinth_Ground_Slab';
                        const floorName = isRoof ? 'Floor_Roof' : 'Floor_0_Ground';

                        const bottomVerts = [
                            new THREE.Vector3(p[0].x * scale * scaleToFeet, slabY * scaleToFeet, p[0].y * scale * scaleToFeet),
                            new THREE.Vector3(p[1].x * scale * scaleToFeet, slabY * scaleToFeet, p[1].y * scale * scaleToFeet),
                            new THREE.Vector3(p[2].x * scale * scaleToFeet, slabY * scaleToFeet, p[2].y * scale * scaleToFeet),
                            new THREE.Vector3(p[3].x * scale * scaleToFeet, slabY * scaleToFeet, p[3].y * scale * scaleToFeet)
                        ];
                        const topVerts = bottomVerts.map(v => new THREE.Vector3(v.x, v.y + (slabThickness * scaleToFeet), v.z));

                        const verts = [...bottomVerts, ...topVerts];
                        const faces = [
                            [3, 2, 1, 0], // Bottom
                            [4, 5, 6, 7], // Top
                            [0, 1, 5, 4], // Side 1
                            [1, 2, 6, 5], // Side 2
                            [2, 3, 7, 6], // Side 3
                            [3, 0, 4, 7]  // Side 4
                        ];

                        quadMeshes.push({
                            name: slabName,
                            floor: floorName,
                            vertices: verts,
                            faces: faces
                        });
                    }
                }
            }
        });
    }

    // Ensure upper floor slabs are quad-meshed with exact 8-vertex, 6-quad geometry
    if (state.floors && state.floors.length > 1 && state.boundaryPolygon.length === 4) {
        const p = state.boundaryPolygon;
        const wallHeight = 11 * ppf3D;
        const slabThickness = 0.75 * ppf3D;

        for (let fIdx = 1; fIdx < state.floors.length; fIdx++) {
            const slabY = fIdx * wallHeight;
            const floorName = `Floor_${fIdx}_${state.floors[fIdx].name || 'Upper'}`;
            const slabName = `Floor_Slab_${fIdx}`;

            const exists = quadMeshes.some(m => m.name === slabName);
            if (!exists) {
                const bottomVerts = [
                    new THREE.Vector3(p[0].x * scale * scaleToFeet, slabY * scaleToFeet, p[0].y * scale * scaleToFeet),
                    new THREE.Vector3(p[1].x * scale * scaleToFeet, slabY * scaleToFeet, p[1].y * scale * scaleToFeet),
                    new THREE.Vector3(p[2].x * scale * scaleToFeet, slabY * scaleToFeet, p[2].y * scale * scaleToFeet),
                    new THREE.Vector3(p[3].x * scale * scaleToFeet, slabY * scaleToFeet, p[3].y * scale * scaleToFeet)
                ];
                const topVerts = bottomVerts.map(v => new THREE.Vector3(v.x, v.y + (slabThickness * scaleToFeet), v.z));
                const verts = [...bottomVerts, ...topVerts];
                const faces = [
                    [3, 2, 1, 0], [4, 5, 6, 7],
                    [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]
                ];
                quadMeshes.push({
                    name: slabName,
                    floor: floorName,
                    vertices: verts,
                    faces: faces
                });
            }
        }
    }

    return quadMeshes;
}

// ----------------------------------------------------------------------------
// 3. Wavefront Quad OBJ Generator
// ----------------------------------------------------------------------------

function generateQuadOBJ(quadMeshes) {
    let output = "# Wavefront OBJ File - Exported by SmartHome QuadMeshExporter\n";
    output += "# Strict Quad Topology (Untriangulated - Pure 4-Vertex Polygons)\n";
    output += "# Units: Feet (1 unit = 1.0 ft)\n\n";

    let vertexOffset = 1; // 1-based index in OBJ
    let currentFloor = "";

    quadMeshes.forEach(mesh => {
        if (mesh.floor !== currentFloor) {
            currentFloor = mesh.floor;
            output += `g ${currentFloor}\n`;
        }

        output += `o ${mesh.name}\n`;

        // Vertices (v x y z)
        mesh.vertices.forEach(v => {
            output += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
        });

        // 4-Vertex Quad Faces (f v1 v2 v3 v4)
        mesh.faces.forEach(f => {
            const v1 = f[0] + vertexOffset;
            const v2 = f[1] + vertexOffset;
            const v3 = f[2] + vertexOffset;
            const v4 = f[3] + vertexOffset;
            output += `f ${v1} ${v2} ${v3} ${v4}\n`;
        });

        vertexOffset += mesh.vertices.length;
        output += "\n";
    });

    return output;
}

// ----------------------------------------------------------------------------
// 4. Autodesk ASCII FBX 7.4 Quad Generator
// ----------------------------------------------------------------------------

function generateQuadFBX(quadMeshes) {
    const time = new Date();
    const year = time.getFullYear();
    const month = time.getMonth() + 1;
    const day = time.getDate();
    const hour = time.getHours();
    const minute = time.getMinutes();
    const second = time.getSeconds();

    // Group meshes by floor hierarchy
    const floorGroups = {};
    quadMeshes.forEach(m => {
        if (!floorGroups[m.floor]) floorGroups[m.floor] = [];
        floorGroups[m.floor].push(m);
    });

    const floorNames = Object.keys(floorGroups);
    let idCounter = 1000;
    const floorIds = {};
    floorNames.forEach(fn => {
        floorIds[fn] = idCounter++;
    });

    const meshData = [];
    quadMeshes.forEach(m => {
        const modelId = idCounter++;
        const geomId = idCounter++;
        meshData.push({
            mesh: m,
            modelId: modelId,
            geomId: geomId,
            floorId: floorIds[m.floor]
        });
    });

    let s = `; FBX 7.4.0 project file
; Created by SmartHome QuadMeshExporter
; Pure Quad Topology (Untriangulated - 4-Vertex Polygons)
; --------------------------------------------------

FBXHeaderExtension:  {
\tFBXHeaderVersion: 1003
\tFBXVersion: 7400
\tCreationTimeStamp:  {
\t\tVersion: 1000
\t\tYear: ${year}
\t\tMonth: ${month}
\t\tDay: ${day}
\t\tHour: ${hour}
\t\tMinute: ${minute}
\t\tSecond: ${second}
\t\tMillisecond: 0
\t}
\tCreator: "SmartHome QuadMeshExporter"
}

GlobalSettings:  {
\tVersion: 1000
\tProperties70:  {
\t\tP: "UpAxis", "int", "Integer", "",1
\t\tP: "UpAxisSign", "int", "Integer", "",1
\t\tP: "FrontAxis", "int", "Integer", "",2
\t\tP: "FrontAxisSign", "int", "Integer", "",1
\t\tP: "CoordAxis", "int", "Integer", "",0
\t\tP: "CoordAxisSign", "int", "Integer", "",1
\t\tP: "UnitScaleFactor", "double", "Number", "",1.0
\t}
}

Documents:  {
\tCount: 1
\tDocument: 100, "", "Scene" {
\t\tProperties70:  {
\t\t\tP: "SourceObject", "object", "", ""
\t\t\tP: "ActiveAnimStackName", "KString", "", "", ""
\t\t}
\t\tRootNode: 0
\t}
}

References:  {
}

Definitions:  {
\tVersion: 100
\tCount: ${1 + floorNames.length + meshData.length * 2}
\tObjectType: "GlobalSettings" {
\t\tCount: 1
\t}
\tObjectType: "Model" {
\t\tCount: ${floorNames.length + meshData.length}
\t\tPropertyTemplate: "FbxNode" {
\t\t\tProperties70:  {
\t\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",0,0,0
\t\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0
\t\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
\t\t\t}
\t\t}
\t}
\tObjectType: "Geometry" {
\t\tCount: ${meshData.length}
\t\tPropertyTemplate: "FbxMesh" {
\t\t\tProperties70:  {
\t\t\t\tP: "Color", "ColorRGB", "Color", "",0.8,0.8,0.8
\t\t\t}
\t\t}
\t}
}

Objects:  {
`;

    // Floor Null Parent Models
    floorNames.forEach(fn => {
        const fid = floorIds[fn];
        s += `\tModel: ${fid}, "Model::${fn}", "Null" {\n`;
        s += `\t\tVersion: 232\n`;
        s += `\t\tProperties70:  {\n`;
        s += `\t\t\tP: "InheritType", "enum", "", "",1\n`;
        s += `\t\t}\n`;
        s += `\t\tShading: T\n`;
        s += `\t\tCulling: "CullingOff"\n`;
        s += `\t}\n`;
    });

    // Individual Architectural Mesh Models & Geometries
    meshData.forEach(md => {
        const m = md.mesh;
        s += `\tModel: ${md.modelId}, "Model::${m.name}", "Mesh" {\n`;
        s += `\t\tVersion: 232\n`;
        s += `\t\tProperties70:  {\n`;
        s += `\t\t\tP: "InheritType", "enum", "", "",1\n`;
        s += `\t\t}\n`;
        s += `\t\tShading: T\n`;
        s += `\t\tCulling: "CullingOff"\n`;
        s += `\t}\n`;

        // Vertices flat array (x, y, z)
        const vArr = [];
        m.vertices.forEach(v => {
            vArr.push(v.x.toFixed(4), v.y.toFixed(4), v.z.toFixed(4));
        });

        // PolygonVertexIndex: 4-index quad loops with bitwise-negated 4th index (-i - 1)
        const polyArr = [];
        m.faces.forEach(f => {
            polyArr.push(f[0], f[1], f[2], -f[3] - 1);
        });

        s += `\tGeometry: ${md.geomId}, "Geometry::${m.name}", "Mesh" {\n`;
        s += `\t\tVertices: *${vArr.length} {\n`;
        s += `\t\t\ta: ${vArr.join(',')}\n`;
        s += `\t\t}\n`;
        s += `\t\tPolygonVertexIndex: *${polyArr.length} {\n`;
        s += `\t\t\ta: ${polyArr.join(',')}\n`;
        s += `\t\t}\n`;
        s += `\t\tGeometryVersion: 124\n`;
        s += `\t}\n`;
    });

    s += `}\n\nConnections:  {\n`;

    // Floor Models connected to RootNode 0
    floorNames.forEach(fn => {
        const fid = floorIds[fn];
        s += `\tC: "OO", ${fid}, 0\n`;
    });

    // Mesh Models connected to Floor Models & Geometries to Mesh Models
    meshData.forEach(md => {
        s += `\tC: "OO", ${md.modelId}, ${md.floorId}\n`;
        s += `\tC: "OO", ${md.geomId}, ${md.modelId}\n`;
    });

    s += `}\n`;

    return s;
}

// ----------------------------------------------------------------------------
// 5. Download Triggers
// ----------------------------------------------------------------------------

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportQuadOBJ() {
    const quadMeshes = collectQuadMeshes();
    if (!quadMeshes || quadMeshes.length === 0) {
        alert("No 3D architectural geometry found to export. Switch to 3D view first.");
        return;
    }
    const objText = generateQuadOBJ(quadMeshes);
    downloadFile(objText, "SmartHome_Building_Quads.obj", "text/plain");
}

function exportQuadFBX() {
    const quadMeshes = collectQuadMeshes();
    if (!quadMeshes || quadMeshes.length === 0) {
        alert("No 3D architectural geometry found to export. Switch to 3D view first.");
        return;
    }
    const fbxText = generateQuadFBX(quadMeshes);
    downloadFile(fbxText, "SmartHome_Building_Quads.fbx", "text/plain");
}
