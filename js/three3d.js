/**
 * ============================================================================
 * renderer3d.js - Three.js 3D Scene Setup, Mesh Generation & Walkthrough Controls
 * ============================================================================
 */

let webglContainer = null;
let scene = null;
let camera = null;
let renderer = null;
let orbitControls = null;
let walkthroughControls = null;
let houseGroup = null;

let isWalkthroughMode = false;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
let velocity = null;
let direction = null;
let headBobTimer = 0;

// Walkthrough Physics, Collision & Interaction State
let collidableWalls = [];
let interactiveDoors = [];
let staircaseZones = [];
let activeNearestDoor = null;
let playerBaseY = 0;
let animatedFanRotors = [];

// 3D Direct Manipulation & Transform Gizmo State
let selected3DItem = null;
let selected3DFloor = null;
let selected3DType = null;
let gizmoGroup = null;
let raycaster = null;
let mouseVec = null;
let pointerDownPos = { x: 0, y: 0 };

// Real-Time Day/Night Lighting & Sun Simulation Global State
let dirLight = null;
let hemiLight = null;
let ambLight = null;
let sunSphere = null;
let interiorLights = [];
let interiorLightsManual = null; // null: auto, true: forced ON, false: forced OFF
let currentSimHour = 12.0;

function init3D() {
    try {
        webglContainer = document.getElementById('webgl-container');
        if (!webglContainer) return;

        if (typeof THREE === 'undefined') {
            console.warn('Three.js library is not loaded. 3D mode disabled.');
            return;
        }

        velocity = new THREE.Vector3();
        direction = new THREE.Vector3();

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xa0c4ff);
        scene.fog = new THREE.FogExp2(0xa0c4ff, 0.00025);

        const cWidth = webglContainer.clientWidth || (window.innerWidth - 384);
        const cHeight = webglContainer.clientHeight || window.innerHeight;

        camera = new THREE.PerspectiveCamera(65, cWidth / (cHeight || 1), 0.5, 5000);
        camera.position.set(0, 200, 250);

        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setSize(cWidth, cHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        webglContainer.appendChild(renderer.domElement);

        // Natural Environment Lighting with Global References for Sun Simulation
        ambLight = new THREE.AmbientLight(0xffffff, 0.45);
        scene.add(ambLight);

        hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 200, 0);
        scene.add(hemiLight);

        dirLight = new THREE.DirectionalLight(0xfff5b6, 1.0); // Warm sunlight
        dirLight.position.set(100, 200, 150);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 3000;
        const d = 600;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.0005;
        scene.add(dirLight);
        scene.add(dirLight.target);

    // Visual Glowing Sun / Moon Mesh in Sky
    const sunGeo = new THREE.SphereGeometry(14, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff5b6, fog: false });
    sunSphere = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunSphere);

    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.01;

    walkthroughControls = new THREE.PointerLockControls(camera, renderer.domElement);

    webglContainer.addEventListener('click', () => {
        if (isWalkthroughMode && !walkthroughControls.isLocked) {
            walkthroughControls.lock();
        }
    });

    // Prevent pointerlock or canvas click handlers from capturing clicks on the sun controller
    const sunBar = document.getElementById('sun-simulator-bar');
    if (sunBar) {
        sunBar.addEventListener('click', (e) => e.stopPropagation());
        sunBar.addEventListener('pointerdown', (e) => e.stopPropagation());
        sunBar.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    if (state.sunSimulation && state.sunSimulation.hour !== undefined) {
        currentSimHour = state.sunSimulation.hour;
        interiorLightsManual = state.sunSimulation.interiorLightsManual;
    }
    updateSunSimulation(currentSimHour);

    walkthroughControls.addEventListener('lock', () => {
        if (isWalkthroughMode) {
            const inst = document.getElementById('walk-instructions');
            if (inst) {
                inst.innerHTML = '<span><kbd class="bg-gray-700 px-2 py-1 rounded">W</kbd> <kbd class="bg-gray-700 px-2 py-1 rounded">A</kbd> <kbd class="bg-gray-700 px-2 py-1 rounded">S</kbd> <kbd class="bg-gray-700 px-2 py-1 rounded">D</kbd> to Walk</span> <span class="text-gray-400">|</span> <span><kbd class="bg-indigo-600 px-2 py-1 rounded">E</kbd> Open/Close Doors</span> <span class="text-gray-400">|</span> <span>Move mouse to look</span> <span class="text-gray-400">|</span> <span><kbd class="bg-gray-700 px-2 py-1 rounded">ESC</kbd> to unlock</span>';
                inst.style.display = 'flex';
            }
        }
    });

    walkthroughControls.addEventListener('unlock', () => {
        if (isWalkthroughMode) {
            const inst = document.getElementById('walk-instructions');
            if (inst) {
                inst.innerHTML = '<span><i class="fa-solid fa-computer-mouse mr-1"></i> Click screen to resume walkthrough</span> <span class="text-gray-400">|</span> <span>Switch tabs above to exit</span>';
                inst.style.display = 'flex';
            }
        }
    });

    houseGroup = new THREE.Group();
    scene.add(houseGroup);

    // Initialize 3D Transform Gizmo handles
    gizmoGroup = buildGizmoMesh();
    scene.add(gizmoGroup);

    raycaster = new THREE.Raycaster();
    mouseVec = new THREE.Vector2();

    // Direct object selection & gizmo click listeners
    renderer.domElement.addEventListener('pointerdown', (e) => {
        pointerDownPos.x = e.clientX;
        pointerDownPos.y = e.clientY;
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        if (isWalkthroughMode) return;
        const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (dist > 6) return; // Orbit rotation drag, not an intentional click
        handle3DPointerClick(e);
    });

    renderer.domElement.addEventListener('pointermove', (e) => {
        if (isWalkthroughMode || !scene || !camera) return;
        const rect = renderer.domElement.getBoundingClientRect();
        mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseVec, camera);

        if (gizmoGroup && gizmoGroup.visible) {
            const gizmoHits = raycaster.intersectObjects(gizmoGroup.children, true);
            if (gizmoHits.length > 0) {
                renderer.domElement.style.cursor = 'pointer';
                return;
            }
        }

        const hits = raycaster.intersectObjects(houseGroup.children, true);
        let hasItem = false;
        for (let i = 0; i < hits.length; i++) {
            let obj = hits[i].object;
            while (obj && obj !== houseGroup) {
                if (obj.userData && obj.userData.item) {
                    hasItem = true;
                    break;
                }
                obj = obj.parent;
            }
            if (hasItem) break;
        }
        renderer.domElement.style.cursor = hasItem ? 'pointer' : 'default';
    });

    window.addEventListener('keydown', (e) => {
        if (isWalkthroughMode) {
            switch (e.code) {
                case 'ArrowUp': case 'KeyW': moveForward = true; break;
                case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
                case 'ArrowDown': case 'KeyS': moveBackward = true; break;
                case 'ArrowRight': case 'KeyD': moveRight = true; break;
                case 'KeyE': toggleNearestDoor(); break;
            }
        } else if (selected3DItem) {
            if (e.code === 'ArrowLeft') { e.preventDefault(); nudge3DObject('left'); }
            else if (e.code === 'ArrowRight') { e.preventDefault(); nudge3DObject('right'); }
            else if (e.code === 'ArrowUp') { e.preventDefault(); nudge3DObject('back'); }
            else if (e.code === 'ArrowDown') { e.preventDefault(); nudge3DObject('front'); }
            else if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); delete3DSelected(); }
            else if (e.code === 'Escape') { deselect3DObject(); }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (!isWalkthroughMode) return;
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': moveForward = false; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
            case 'ArrowDown': case 'KeyS': moveBackward = false; break;
            case 'ArrowRight': case 'KeyD': moveRight = false; break;
        }
    });

    window.addEventListener('resize', () => {
        if (webglContainer && webglContainer.style.display !== 'none' && camera && renderer) {
            const width = webglContainer.clientWidth || (window.innerWidth - 384);
            const height = webglContainer.clientHeight || window.innerHeight;
            camera.aspect = width / (height || 1);
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }
    });

    animate3D();
    } catch (err) {
        console.warn('3D initialization deferred or WebGL unavailable:', err);
    }
}

function animate3D() {
    requestAnimationFrame(animate3D);

    // Safeguard: Stop rendering if 3D container is hidden (in 2D Steps 1-5).
    // This saves 100% GPU/VRAM resources and prevents WebGL context loss crashes.
    if (!webglContainer || webglContainer.style.display === 'none' || webglContainer.offsetParent === null) {
        return;
    }

    const time = performance.now();

    if (isWalkthroughMode && walkthroughControls && walkthroughControls.isLocked) {
        const delta = Math.min((time - prevTime) / 1000, 0.1);
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speed = 300.0;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        const scale = 0.5;
        const ppf3D = state.pixelsPerFoot * scale;
        const wallHeight = 11.0 * ppf3D; // Standard building floor height
        const eyeHeight = 5.5 * ppf3D;
        const collisionRadius = 1.2 * ppf3D;

        // 1. Calculate intended movement in world space projected on horizontal plane
        const rightDist = -velocity.x * delta;
        const forwardDist = -velocity.z * delta;

        const vecRight = new THREE.Vector3();
        vecRight.setFromMatrixColumn(camera.matrix, 0);
        vecRight.y = 0;
        vecRight.normalize();

        const vecForward = new THREE.Vector3();
        vecForward.crossVectors(camera.up, vecRight);
        vecForward.y = 0;
        vecForward.normalize();

        const moveDeltaX = vecRight.x * rightDist + vecForward.x * forwardDist;
        const moveDeltaZ = vecRight.z * rightDist + vecForward.z * forwardDist;

        // 2. Wall Collision Detection (1.2 ft radius cylinder)
        const currentX = camera.position.x;
        const currentZ = camera.position.z;
        const footY = playerBaseY;
        const headY = playerBaseY + 6.0 * ppf3D;

        let nextX = currentX + moveDeltaX;
        let nextZ = currentZ + moveDeltaZ;

        // Test X axis independently for smooth wall sliding
        if (checkWallCollision(nextX, currentZ, footY, headY, collisionRadius)) {
            nextX = currentX;
            velocity.x = 0;
        }
        // Test Z axis independently for smooth wall sliding
        if (checkWallCollision(nextX, nextZ, footY, headY, collisionRadius)) {
            nextZ = currentZ;
            velocity.z = 0;
        }

        camera.position.x = nextX;
        camera.position.z = nextZ;

        // 3. Multi-Floor Stair Climbing & Gravity Interpolation
        const stairCheck = getStairElevation(camera.position.x, camera.position.z, playerBaseY, ppf3D);
        if (stairCheck.onStair) {
            playerBaseY += (stairCheck.targetY - playerBaseY) * Math.min(delta * 14.0, 1.0);
        } else {
            const numFloors = (state.floors && state.floors.length) || 1;
            const currentFloorLevel = Math.min(numFloors - 1, Math.max(0, Math.round(playerBaseY / wallHeight)));
            const targetFloorY = currentFloorLevel * wallHeight;
            playerBaseY += (targetFloorY - playerBaseY) * Math.min(delta * 10.0, 1.0);
            if (state.currentFloorIndex !== currentFloorLevel) {
                state.currentFloorIndex = currentFloorLevel;
                if (typeof renderFloorButtons === 'function') renderFloorButtons();
            }
        }

        // 4. Camera Head-Bobbing & Vertical Position
        const isMoving = (Math.abs(velocity.x) > 5 || Math.abs(velocity.z) > 5);
        if (isMoving) {
            headBobTimer += delta * 10;
            camera.position.y = playerBaseY + eyeHeight + Math.sin(headBobTimer) * 0.8;
        } else {
            camera.position.y += ((playerBaseY + eyeHeight) - camera.position.y) * 0.15;
        }

        // 5. Interactive Door Angle Smooth Lerp
        for (let i = 0; i < interactiveDoors.length; i++) {
            const door = interactiveDoors[i];
            if (Math.abs(door.targetAngle - door.currentAngle) > 0.001) {
                door.currentAngle += (door.targetAngle - door.currentAngle) * Math.min(delta * 8.0, 1.0);
                door.hingeGroup.rotation.y = door.baseAngle + door.currentAngle;
            }
        }

        // 6. Proximity Door HUD Prompt (< 8 feet with viewing angle check)
        const maxDoorDist = 8.0 * ppf3D;
        let nearestDoor = null;
        let nearestDist = maxDoorDist;

        const forwardVec = new THREE.Vector3();
        camera.getWorldDirection(forwardVec);
        forwardVec.y = 0;
        forwardVec.normalize();

        for (let i = 0; i < interactiveDoors.length; i++) {
            const d = interactiveDoors[i];
            const vertDist = Math.abs(camera.position.y - (d.baseY + d.doorHeight / 2));
            if (vertDist > wallHeight * 0.7) continue;
            const toDoorX = d.centerX - camera.position.x;
            const toDoorZ = d.centerZ - camera.position.z;
            const dist = Math.hypot(toDoorX, toDoorZ);
            if (dist < nearestDist) {
                const dirLen = Math.hypot(toDoorX, toDoorZ);
                const dot = (forwardVec.x * toDoorX + forwardVec.z * toDoorZ) / (dirLen || 1);
                if (dot > 0.05 || dist < 3.0 * ppf3D) {
                    nearestDist = dist;
                    nearestDoor = d;
                }
            }
        }
        activeNearestDoor = nearestDoor;

        const doorHud = document.getElementById('door-interaction-hud');
        const doorHudText = document.getElementById('door-hud-text');
        if (doorHud && doorHudText) {
            if (nearestDoor) {
                doorHudText.innerText = nearestDoor.isOpen ? "Press [E] to Close Door" : "Press [E] to Open Door";
                doorHud.style.display = 'flex';
            } else {
                doorHud.style.display = 'none';
            }
        }
    } else if (!isWalkthroughMode && orbitControls && scene && scene.visible) {
        orbitControls.update();
    }

    // Rotate 3D ceiling fan blades continuously in Orbit and Walkthrough modes
    if (animatedFanRotors.length > 0) {
        const fanDelta = Math.min((time - prevTime) / 1000, 0.1);
        for (let f = 0; f < animatedFanRotors.length; f++) {
            animatedFanRotors[f].rotation.y += fanDelta * 8.0;
        }
    }

    prevTime = time;
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ----------------------------------------------------------------------------
// Walkthrough Collision Detection & Stair Climbing Engine
// ----------------------------------------------------------------------------

function checkWallCollision(px, pz, footY, headY, radius) {
    const playerBox = new THREE.Box3(
        new THREE.Vector3(px - radius, footY + 0.1, pz - radius),
        new THREE.Vector3(px + radius, headY, pz + radius)
    );

    for (let i = 0; i < collidableWalls.length; i++) {
        const wall = collidableWalls[i];
        if (wall.isDoor && wall.doorRef && wall.doorRef.isOpen) continue;

        // Vertical overlap check
        if (headY < wall.baseY || footY > wall.topY) continue;

        // 1. Broad-phase AABB test with THREE.Box3
        if (!wall.box.intersectsBox(playerBox)) continue;

        // 2. Narrow-phase segment distance check
        const dx = wall.x2 - wall.x1;
        const dz = wall.z2 - wall.z1;
        const lenSq = dx * dx + dz * dz;
        const halfThick = (wall.thickness || 1.0) / 2;
        const minDist = radius + halfThick;

        if (lenSq < 0.001) {
            const dist = Math.hypot(px - wall.x1, pz - wall.z1);
            if (dist < minDist) return true;
        } else {
            const u = Math.max(0, Math.min(1, ((px - wall.x1) * dx + (pz - wall.z1) * dz) / lenSq));
            const cx = wall.x1 + u * dx;
            const cz = wall.z1 + u * dz;
            const dist = Math.hypot(px - cx, pz - cz);
            if (dist < minDist) return true;
        }
    }
    return false;
}

function getStairElevation(px, pz, currentFootY, ppf3D) {
    for (let i = 0; i < staircaseZones.length; i++) {
        const zone = staircaseZones[i];
        const stairMinY = zone.baseY - 1.5 * ppf3D;
        const stairMaxY = zone.baseY + zone.totalHeight + 1.5 * ppf3D;
        if (currentFootY < stairMinY || currentFootY > stairMaxY) continue;

        if (zone.layout === 'line') {
            const dx = zone.x2 - zone.x1;
            const dz = zone.z2 - zone.z1;
            const lenSq = dx * dx + dz * dz;
            if (lenSq < 0.1) continue;
            const u = ((px - zone.x1) * dx + (pz - zone.z1) * dz) / lenSq;
            if (u < -0.1 || u > 1.1) continue;

            const perpDist = Math.abs((px - zone.x1) * dz - (pz - zone.z1) * dx) / Math.sqrt(lenSq);
            if (perpDist <= zone.flightWidth / 2 + 0.8 * ppf3D) {
                const prog = Math.max(0, Math.min(1, u));
                return { onStair: true, targetY: zone.baseY + prog * zone.totalHeight, floorIndex: zone.floorIndex };
            }
            continue;
        }

        // Layout stairs: convert (px, pz) to local stairGroup coordinates
        const dx = px - zone.cx;
        const dz = pz - zone.cz;
        const rotRad = ((zone.rotDeg || 0) * Math.PI) / 180;
        let lx = dx * Math.cos(rotRad) - dz * Math.sin(rotRad);
        let lz = dx * Math.sin(rotRad) + dz * Math.cos(rotRad);
        if (zone.flip) lx = -lx;

        const fw = zone.flightWidth;
        const totalHeight = zone.totalHeight;
        const landingElevation = totalHeight * 0.5;

        if (zone.layout === 'straight') {
            const treads = Math.max(1, zone.numSteps - 1);
            const totalL = treads * zone.treadDepth;
            const topZ = -totalL / 2;
            const bottomZ = totalL / 2;

            if (Math.abs(lx) <= (fw / 2 + 0.8 * ppf3D) && lz >= (topZ - 0.8 * ppf3D) && lz <= (bottomZ + 0.8 * ppf3D)) {
                const prog = Math.max(0, Math.min(1, (bottomZ - lz) / totalL));
                return { onStair: true, targetY: zone.baseY + prog * totalHeight, floorIndex: zone.floorIndex };
            }
        } else if (zone.layout === 'u_shape') {
            const totalW = fw * 2 + zone.wellGap;
            const totalL = zone.landingDepth + zone.flightRun;
            const leftX = -totalW / 2;
            const topZ = -totalL / 2;

            if (lx >= (leftX - 0.8 * ppf3D) && lx <= (totalW / 2 + 0.8 * ppf3D) && lz >= (topZ - 0.8 * ppf3D) && lz <= (topZ + totalL + 0.8 * ppf3D)) {
                // Landing area (top Z)
                if (lz <= topZ + zone.landingDepth + 0.2 * ppf3D) {
                    return { onStair: true, targetY: zone.baseY + landingElevation, floorIndex: zone.floorIndex };
                }
                // Flight 1 (Left flight, ascending towards landing)
                if (lx <= 0) {
                    const p1 = Math.max(0, Math.min(1, ((topZ + totalL) - lz) / zone.flightRun));
                    return { onStair: true, targetY: zone.baseY + p1 * landingElevation, floorIndex: zone.floorIndex };
                }
                // Flight 2 (Right flight, ascending towards upper floor)
                else {
                    const p2 = Math.max(0, Math.min(1, (lz - (topZ + zone.landingDepth)) / zone.flightRun));
                    return { onStair: true, targetY: zone.baseY + landingElevation + p2 * (totalHeight - landingElevation), floorIndex: zone.floorIndex };
                }
            }
        } else if (zone.layout === 'l_shape') {
            const totalW = fw + zone.flightRun;
            const totalL = fw + zone.flightRun;
            const leftX = -totalW / 2;
            const topZ = -totalL / 2;

            if (lx >= (leftX - 0.8 * ppf3D) && lx <= (leftX + totalW + 0.8 * ppf3D) && lz >= (topZ - 0.8 * ppf3D) && lz <= (topZ + totalL + 0.8 * ppf3D)) {
                // Corner landing
                if (lx <= leftX + fw + 0.2 * ppf3D && lz <= topZ + fw + 0.2 * ppf3D) {
                    return { onStair: true, targetY: zone.baseY + landingElevation, floorIndex: zone.floorIndex };
                }
                // Flight 1 (ascending along Z to corner landing)
                if (lx <= leftX + fw + 0.2 * ppf3D && lz > topZ + fw) {
                    const p1 = Math.max(0, Math.min(1, ((topZ + totalL) - lz) / zone.flightRun));
                    return { onStair: true, targetY: zone.baseY + p1 * landingElevation, floorIndex: zone.floorIndex };
                }
                // Flight 2 (ascending from corner landing to right along X)
                if (lz <= topZ + fw + 0.2 * ppf3D && lx > leftX + fw) {
                    const p2 = Math.max(0, Math.min(1, (lx - (leftX + fw)) / zone.flightRun));
                    return { onStair: true, targetY: zone.baseY + landingElevation + p2 * (totalHeight - landingElevation), floorIndex: zone.floorIndex };
                }
            }
        }
    }
    return { onStair: false };
}

function updateDoorCollision(door) {
    if (!door) return;
    if (door.isOpen) {
        const idx = collidableWalls.findIndex(w => w.doorRef === door);
        if (idx !== -1) {
            door._removedWallEntry = collidableWalls.splice(idx, 1)[0];
        }
    } else {
        if (door._removedWallEntry) {
            collidableWalls.push(door._removedWallEntry);
            door._removedWallEntry = null;
        }
    }
}

function toggleNearestDoor() {
    if (!activeNearestDoor) return;
    activeNearestDoor.isOpen = !activeNearestDoor.isOpen;
    activeNearestDoor.targetAngle = activeNearestDoor.isOpen ? (Math.PI / 2) : 0;
    updateDoorCollision(activeNearestDoor);
    if (typeof showToast === 'function') {
        showToast(activeNearestDoor.isOpen ? "Door Opened (Walkway clear)" : "Door Closed", "info");
    }
}
window.toggleNearestDoor = toggleNearestDoor;

function findSafeSpawnPosition(startX, startZ, footY, radius, ppf3D) {
    if (!checkWallCollision(startX, startZ, footY, footY + 6.0 * ppf3D, radius)) {
        return { x: startX, z: startZ };
    }
    const step = 2.0 * ppf3D;
    const offsets = [
        [0, -step], [0, step], [-step, 0], [step, 0],
        [0, -step * 2], [0, step * 2], [-step * 2, 0], [step * 2, 0],
        [-step, -step], [step, -step], [-step, step], [step, step]
    ];
    for (let i = 0; i < offsets.length; i++) {
        const tx = startX + offsets[i][0];
        const tz = startZ + offsets[i][1];
        if (!checkWallCollision(tx, tz, footY, footY + 6.0 * ppf3D, radius)) {
            return { x: tx, z: tz };
        }
    }
    return { x: startX, z: startZ };
}

function disableFrustumCulling(obj) {
    if (!obj) return;
    obj.traverse((child) => {
        if (child.isMesh) {
            child.frustumCulled = false;
        }
    });
}

function addStairVoidHoles(shape, stairsList, scale, ppf3D, p) {
    if (!stairsList || stairsList.length === 0 || !p || p.length < 3) return;

    // Filter for floor-connecting stairs (exclude base steps or stairs where autoCutout is toggled OFF)
    const activeStairs = stairsList.filter(s => s.type === 'asset_stair' && (s.subType === 'main' || s.layout || s.x !== undefined) && s.subType !== 'base' && s.autoCutout !== false);
    if (activeStairs.length === 0) return;

    const outerPts = shape.getPoints();
    const isOuterClockwise = THREE.ShapeUtils.isClockwise(outerPts);

    const polyMinX = Math.min(...p.map(pt => pt.x * scale));
    const polyMaxX = Math.max(...p.map(pt => pt.x * scale));
    const polyMinY = Math.min(...p.map(pt => pt.y * scale));
    const polyMaxY = Math.max(...p.map(pt => pt.y * scale));
    const inset = 0.2; // strictly inside perimeter so earcut never has edge collision with boundary

    activeStairs.forEach(s => {
        let holePts = [];

        if (s.layout || s.x !== undefined) {
            const cx = (s.x !== undefined ? s.x : (s.x1 + s.x2) / 2) * scale;
            const cy = (s.y !== undefined ? s.y : (s.y1 + s.y2) / 2) * scale;
            const rotRad = ((s.rotation || 0) * Math.PI) / 180;
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);

            const wFt = (s.widthFt || (s.layout === 'straight' ? 3.0 : 6.5));
            const lFt = (s.lengthFt || (s.layout === 'straight' ? 10.0 : 10.5));
            const hw = (wFt / 2) * ppf3D;
            const hl = (lFt / 2) * ppf3D;

            // 4 oriented bounding corners including landing pad
            const localCorners = [
                { x: -hw, y: -hl },
                { x: hw, y: -hl },
                { x: hw, y: hl },
                { x: -hw, y: hl }
            ];

            holePts = localCorners.map(pt => {
                const rx = cx + pt.x * cos - pt.y * sin;
                const ry = cy + pt.x * sin + pt.y * cos;
                return {
                    x: Math.max(polyMinX + inset, Math.min(polyMaxX - inset, rx)),
                    y: Math.max(polyMinY + inset, Math.min(polyMaxY - inset, ry))
                };
            });
        } else {
            // Line segment stairs (x1, y1) to (x2, y2)
            const sx1 = s.x1 * scale, sz1 = s.y1 * scale;
            const sx2 = s.x2 * scale, sz2 = s.y2 * scale;
            const dx = sx2 - sx1, dy = sz2 - sz1;
            const len = Math.hypot(dx, dy);
            if (len < 0.1) return;

            const stairWidth = (s.stairWidthFt || 3.0) * ppf3D;
            const nx = -dy / len;
            const ny = dx / len;

            const c1 = { x: sx1 + nx * stairWidth / 2, y: sz1 + ny * stairWidth / 2 };
            const c2 = { x: sx2 + nx * stairWidth / 2, y: sz2 + ny * stairWidth / 2 };
            const c3 = { x: sx2 - nx * stairWidth / 2, y: sz2 - ny * stairWidth / 2 };
            const c4 = { x: sx1 - nx * stairWidth / 2, y: sz1 - ny * stairWidth / 2 };

            holePts = [c1, c2, c3, c4].map(pt => ({
                x: Math.max(polyMinX + inset, Math.min(polyMaxX - inset, pt.x)),
                y: Math.max(polyMinY + inset, Math.min(polyMaxY - inset, pt.y))
            }));
        }

        if (holePts.length < 3) return;

        // Ensure non-zero area
        const area = THREE.ShapeUtils.area(holePts);
        if (Math.abs(area) < 5) return;

        // Enforce opposite winding order against outer boundary shape
        const isHoleClockwise = THREE.ShapeUtils.isClockwise(holePts);
        if (isOuterClockwise === isHoleClockwise) {
            holePts.reverse();
        }

        const hole = new THREE.Path();
        hole.moveTo(holePts[0].x, holePts[0].y);
        for (let i = 1; i < holePts.length; i++) {
            hole.lineTo(holePts[i].x, holePts[i].y);
        }
        hole.closePath();
        shape.holes.push(hole);
    });
}

// ============================================================================
// Procedural Canvas Textures & PBR Material Engine (Zero External Assets)
// ============================================================================
const proceduralTextureCache = {};

function createProceduralTexture(type) {
    if (proceduralTextureCache[type]) {
        return proceduralTextureCache[type];
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (type === 'brick') {
        ctx.fillStyle = '#d6d3d1';
        ctx.fillRect(0, 0, 512, 512);
        const brickH = 32;
        const brickW = 64;
        const mortar = 4;
        for (let y = 0; y < 512; y += brickH) {
            const rowIndex = Math.floor(y / brickH);
            const xOffset = (rowIndex % 2 === 0) ? 0 : -brickW / 2;
            for (let x = xOffset; x < 512 + brickW; x += brickW) {
                const r = 175 + Math.floor(Math.sin(x * 12.3 + y * 4.7) * 20);
                const g = 30 + Math.floor(Math.cos(x * 7.1 + y * 9.2) * 10);
                const b = 30 + Math.floor(Math.sin(x * 5.5 - y * 3.1) * 10);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x + mortar / 2, y + mortar / 2, brickW - mortar, brickH - mortar);
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.fillRect(x + mortar / 2, y + brickH - mortar - 3, brickW - mortar, 3);
            }
        }
    } else if (type === 'stone') {
        ctx.fillStyle = '#3a3836';
        ctx.fillRect(0, 0, 512, 512);
        const rows = [40, 56, 36, 64, 48, 52, 44, 60, 56, 56];
        let currentY = 0;
        rows.forEach((rowH, rIdx) => {
            let currentX = (rIdx % 2 === 0) ? 0 : -30;
            while (currentX < 512 + 60) {
                const blockW = 60 + Math.floor(Math.abs(Math.sin(rIdx * 7 + currentX * 3)) * 60);
                const tones = ['#78716c', '#6b7280', '#57534e', '#a8a29e', '#52525b'];
                const tone = tones[(rIdx * 3 + Math.floor(currentX / 40)) % tones.length];
                ctx.fillStyle = tone;
                ctx.fillRect(currentX + 2, currentY + 2, blockW - 4, rowH - 4);
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(currentX + 2, currentY + 2, blockW - 4, 3);
                ctx.fillStyle = 'rgba(0,0,0,0.14)';
                ctx.fillRect(currentX + 2, currentY + rowH - 5, blockW - 4, 3);
                currentX += blockW;
            }
            currentY += rowH;
        });
    } else if (type === 'marble') {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 35; i++) {
            const cx = Math.random() * 512;
            const cy = Math.random() * 512;
            const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
            grad.addColorStop(0, 'rgba(226, 232, 240, 0.45)');
            grad.addColorStop(1, 'rgba(248, 250, 252, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);
        }
        const drawVein = (startX, startY, strokeW, alpha) => {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
            ctx.lineWidth = strokeW;
            ctx.lineCap = 'round';
            let curX = startX;
            let curY = startY;
            ctx.moveTo(curX, curY);
            for (let step = 0; step < 16; step++) {
                curX += (Math.random() - 0.3) * 60;
                curY += (Math.random() + 0.3) * 45;
                ctx.lineTo(curX, curY);
            }
            ctx.stroke();
        };
        for (let v = 0; v < 6; v++) {
            drawVein(Math.random() * 400, -20, 2.5, 0.4);
            drawVein(Math.random() * 500, Math.random() * 200, 1.2, 0.3);
        }
    } else if (type === 'wood') {
        ctx.fillStyle = '#92400e';
        ctx.fillRect(0, 0, 512, 512);
        const plankH = 42;
        for (let y = 0; y < 512; y += plankH) {
            const row = Math.floor(y / plankH);
            const xShift = (row % 3) * 120;
            const plankW = 170;
            for (let x = -170 + xShift; x < 512 + 170; x += plankW) {
                const colors = ['#b45309', '#a16207', '#92400e', '#d97706', '#854d0e'];
                ctx.fillStyle = colors[(row * 2 + Math.floor(x / 100)) % colors.length];
                ctx.fillRect(x + 1, y + 1, plankW - 2, plankH - 2);

                ctx.strokeStyle = 'rgba(0,0,0,0.12)';
                ctx.lineWidth = 1;
                for (let g = 6; g < plankH - 4; g += 7) {
                    ctx.beginPath();
                    ctx.moveTo(x + 1, y + g);
                    ctx.bezierCurveTo(x + 50, y + g + 2, x + 110, y + g - 2, x + plankW - 2, y + g);
                    ctx.stroke();
                }
            }
        }
    } else if (type === 'tile_terracotta') {
        ctx.fillStyle = '#fed7aa';
        ctx.fillRect(0, 0, 512, 512);
        const tileSize = 128;
        const grout = 6;
        for (let y = 0; y < 512; y += tileSize) {
            for (let x = 0; x < 512; x += tileSize) {
                const shade = 180 + Math.floor(Math.sin(x + y) * 20);
                ctx.fillStyle = `rgb(${shade}, 70, 20)`;
                ctx.fillRect(x + grout / 2, y + grout / 2, tileSize - grout, tileSize - grout);

                const grad = ctx.createRadialGradient(x + tileSize / 2, y + tileSize / 2, 10, x + tileSize / 2, y + tileSize / 2, tileSize / 2);
                grad.addColorStop(0, 'rgba(255,255,255,0.06)');
                grad.addColorStop(1, 'rgba(0,0,0,0.15)');
                ctx.fillStyle = grad;
                ctx.fillRect(x + grout / 2, y + grout / 2, tileSize - grout, tileSize - grout);
            }
        }
    } else if (type === 'tile_vitrified') {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, 512, 512);
        const tileSize = 256;
        const grout = 3;
        for (let y = 0; y < 512; y += tileSize) {
            for (let x = 0; x < 512; x += tileSize) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x + grout / 2, y + grout / 2, tileSize - grout, tileSize - grout);

                const grad = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
                grad.addColorStop(0, 'rgba(255,255,255,0.9)');
                grad.addColorStop(0.5, 'rgba(248,250,252,0.9)');
                grad.addColorStop(1, 'rgba(241,245,249,0.7)');
                ctx.fillStyle = grad;
                ctx.fillRect(x + grout / 2, y + grout / 2, tileSize - grout, tileSize - grout);
            }
        }
    } else if (type === 'tile_bathroom') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 512, 512);
        const tileSize = 64;
        const grout = 3;
        for (let y = 0; y < 512; y += tileSize) {
            for (let x = 0; x < 512; x += tileSize) {
                ctx.fillStyle = '#475569';
                ctx.fillRect(x + grout / 2, y + grout / 2, tileSize - grout, tileSize - grout);

                ctx.fillStyle = '#64748b';
                ctx.beginPath();
                ctx.arc(x + tileSize / 2, y + tileSize / 2, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.beginPath();
                ctx.arc(x + tileSize / 2 - 1, y + tileSize / 2 - 1, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (type === 'wood_panel') {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(0, 0, 512, 512);
        const slatW = 32;
        const grooveW = 4;
        for (let x = 0; x < 512; x += slatW) {
            const tones = ['#78350f', '#92400e', '#854d0e', '#713f12', '#a16207'];
            const tone = tones[Math.floor(x / slatW) % tones.length];
            ctx.fillStyle = tone;
            ctx.fillRect(x + grooveW / 2, 0, slatW - grooveW, 512);

            // Subtle vertical grain streaks
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            for (let g = 4; g < slatW - grooveW; g += 6) {
                ctx.beginPath();
                ctx.moveTo(x + g, 0);
                ctx.lineTo(x + g + (Math.sin(x + g) * 2), 512);
                ctx.stroke();
            }

            // Fluted edge highlights
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(x + grooveW / 2, 0, 2, 512);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(x + slatW - grooveW / 2 - 2, 0, 2, 512);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (renderer && renderer.capabilities) {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
    proceduralTextureCache[type] = texture;
    return texture;
}

function getThreeMaterial(materialId, length = 20, height = 11) {
    if (!materialId || typeof MATERIAL_CATALOG === 'undefined' || !MATERIAL_CATALOG[materialId]) {
        return null;
    }
    const def = MATERIAL_CATALOG[materialId];
    let map = null;

    if (def.textureType) {
        const baseTex = createProceduralTexture(def.textureType);
        if (baseTex) {
            map = baseTex.clone();
            map.needsUpdate = true;
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            if (renderer && renderer.capabilities) {
                map.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }

            if (def.category === 'wall') {
                const uRep = Math.max(1, Math.round(length / 10));
                const vRep = Math.max(1, Math.round(height / 8));
                map.repeat.set(uRep, vRep);
            } else {
                map.repeat.set(4, 4);
            }
        }
    }

    const matConfig = {
        color: new THREE.Color(def.colorHex),
        roughness: def.roughness !== undefined ? def.roughness : 0.8,
        metalness: def.metalness !== undefined ? def.metalness : 0.05,
        map: map,
        side: THREE.DoubleSide
    };

    if (map && def.textureType) {
        matConfig.bumpMap = map;
        matConfig.bumpScale = (def.textureType === 'brick' || def.textureType === 'stone') ? 0.08 : 0.04;
    }

    return new THREE.MeshStandardMaterial(matConfig);
}

function disposeHierarchy(obj) {
    if (!obj) return;
    if (obj.children && obj.children.length > 0) {
        while (obj.children.length > 0) {
            disposeHierarchy(obj.children[0]);
            obj.remove(obj.children[0]);
        }
    }
    if (obj.geometry) {
        try { obj.geometry.dispose(); } catch (e) {}
    }
    if (obj.material) {
        try {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => {
                    if (m && m.map) try { m.map.dispose(); } catch (e) {}
                    if (m && m.dispose) m.dispose();
                });
            } else {
                if (obj.material.map) try { obj.material.map.dispose(); } catch (e) {}
                if (obj.material.dispose) obj.material.dispose();
            }
        } catch (e) {}
    }
}

function generate3D() {
    if (!houseGroup) return;

    interiorLights = [];
    collidableWalls = [];
    interactiveDoors = [];
    staircaseZones = [];
    activeNearestDoor = null;
    animatedFanRotors = [];

    disposeHierarchy(houseGroup);

    const scale = 0.5;
    const ppf3D = state.pixelsPerFoot * scale;
    const wallHeight = 11 * ppf3D; // Standard building height 11 ft
    const outerThickness = 0.75 * ppf3D;
    const innerThickness = 0.50 * ppf3D;
    const slabThickness = 0.75 * ppf3D; // Standardized 9-inch solid slab thickness (9/12 ft)

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.9, side: THREE.DoubleSide });

    // Ground & Roads 3D
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 1.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    houseGroup.add(ground);

    if (state.boundaryPolygon.length === 4) {
        const p = state.boundaryPolygon;
        const roadWidth3D = 70 * scale;
        const roadOffset3D = 1 * state.pixelsPerFoot * scale;
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

        const createRoadSegment = (x1, z1, x2, z2, edgeType) => {
            const len = Math.hypot(x2 - x1, z2 - z1);
            let cx = (x1 + x2) / 2;
            let cz = (z1 + z2) / 2;
            if (edgeType === 'front') cz += roadOffset3D + roadWidth3D / 2;
            if (edgeType === 'back') cz -= (roadOffset3D + roadWidth3D / 2);
            if (edgeType === 'left') cx -= (roadOffset3D + roadWidth3D / 2);
            if (edgeType === 'right') cx += (roadOffset3D + roadWidth3D / 2);

            const road = new THREE.Mesh(
                new THREE.BoxGeometry(
                    edgeType === 'left' || edgeType === 'right' ? roadWidth3D : len + roadWidth3D * 2,
                    0.1,
                    edgeType === 'left' || edgeType === 'right' ? len : roadWidth3D
                ),
                roadMat
            );
            road.position.set(cx, 0, cz);
            road.receiveShadow = true;
            houseGroup.add(road);

            const line = new THREE.Mesh(
                new THREE.BoxGeometry(
                    edgeType === 'left' || edgeType === 'right' ? 0.8 : len,
                    0.15,
                    edgeType === 'left' || edgeType === 'right' ? len : 0.8
                ),
                lineMat
            );
            line.position.set(cx, 0.03, cz);
            houseGroup.add(line);
        };

        const isCompound = !!(state.compound && state.compound.enabled);
        const sFront = (isCompound ? (state.compound.setbacks.front || 0) : 0) * ppf3D;
        const sBack = (isCompound ? (state.compound.setbacks.back || 0) : 0) * ppf3D;
        const sLeft = (isCompound ? (state.compound.setbacks.left || 0) : 0) * ppf3D;
        const sRight = (isCompound ? (state.compound.setbacks.right || 0) : 0) * ppf3D;

        const cp = [
            { x: p[0].x * scale - sLeft, z: p[0].y * scale + sFront },
            { x: p[1].x * scale + sRight, z: p[1].y * scale + sFront },
            { x: p[2].x * scale + sRight, z: p[2].y * scale - sBack },
            { x: p[3].x * scale - sLeft, z: p[3].y * scale - sBack }
        ];

        // Draw Roads (placed alongside the outer boundary cp)
        if (state.roads.front) createRoadSegment(cp[0].x, cp[0].z, cp[1].x, cp[1].z, 'front');
        if (state.roads.back) createRoadSegment(cp[3].x, cp[3].z, cp[2].x, cp[2].z, 'back');
        if (state.roads.left) createRoadSegment(cp[3].x, cp[3].z, cp[0].x, cp[0].z, 'left');
        if (state.roads.right) createRoadSegment(cp[1].x, cp[1].z, cp[2].x, cp[2].z, 'right');

        // Build 3D Compound Wall, Pillars, Main Gate & Car Ramp
        if (isCompound) {
            create3DCompoundSystem(cp, p, ppf3D, scale, houseGroup);
        }

        const shape = new THREE.Shape();
        shape.moveTo(p[0].x * scale, p[0].y * scale);
        shape.lineTo(p[1].x * scale, p[1].y * scale);
        shape.lineTo(p[2].x * scale, p[2].y * scale);
        shape.lineTo(p[3].x * scale, p[3].y * scale);
        shape.closePath();

        // Standardized 9-inch solid plinth / ground floor slab (0.75 * ppf3D)
        const groundExtrude = new THREE.ExtrudeGeometry(shape, {
            depth: slabThickness,
            bevelEnabled: false
        });
        const groundFloorObj = (state.floors && state.floors.length > 0) ? state.floors[0] : null;
        const groundMatId = (groundFloorObj && groundFloorObj.floorMaterial) || state.floorMaterial;
        const groundMat = groundMatId ? getThreeMaterial(groundMatId) : new THREE.MeshStandardMaterial({ color: 0xd4b28c, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide });

        const floor = new THREE.Mesh(groundExtrude, groundMat);
        floor.rotation.x = Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        floor.castShadow = true;
        floor.userData = { isFloorSlab: true, floorIndex: 0, floor: groundFloorObj };
        houseGroup.add(floor);
    }

    // ------------------------------------------------------------------------
    // Multi-Floor Vertical Stacking Engine
    // ------------------------------------------------------------------------
    const floorsToRender = (state.floors && state.floors.length > 0) ? state.floors : [{
        name: 'Ground',
        partitions: state.partitions || [],
        rooms: state.rooms || [],
        assets: state.assets || []
    }];

    floorsToRender.forEach((floor, floorIndex) => {
        const baseY = floorIndex * wallHeight;
        const floorBaseY = baseY;
        const floorGroup = new THREE.Group();
        floorGroup.position.y = baseY;

        // Strict Floor Wall Isolation: Render only this floor's outer perimeter walls and partitions
        const floorOuterWalls = (floor.outerWalls && floor.outerWalls.length > 0) ? floor.outerWalls : state.outerWalls;
        const allWalls = [...(floorOuterWalls || []), ...(floor.partitions || [])];
        allWalls.forEach(wall => {
            const x1 = wall.x1 * scale;
            const z1 = wall.y1 * scale;
            const x2 = wall.x2 * scale;
            const z2 = wall.y2 * scale;
            const thickness = wall.thickness === 'thick' ? outerThickness : innerThickness;
            const wallLength = Math.hypot(x2 - x1, z2 - z1);
            const defaultMat = wall.thickness === 'thick' ? wallMat : interiorMat;
            const mat = wall.customMaterial ? getThreeMaterial(wall.customMaterial, wallLength, wallHeight) : defaultMat;

            if (wall.type === 'door') create3DDoor(x1, z1, x2, z2, wallHeight, thickness, wall.subType, floorGroup, mat, wall, floor);
            else if (wall.type === 'window') create3DWindow(x1, z1, x2, z2, wallHeight, thickness, mat, floorGroup, wall, floor);
            else if (wall.type === 'balcony_wall') create3DBalconyWall(x1, z1, x2, z2, wall.heightFt || 3, thickness, floorGroup, wall, floor, mat);
            else create3DWall(x1, z1, x2, z2, wallHeight, thickness, mat, floorGroup, wall, floor);
        });

        // Floor Assets (Slabs, Stairs, Furniture)
        const floorAssets = floor.assets || [];
        const legacyStairs = floorAssets.filter(a => a.type === 'asset_stair' && a.subType === 'main' && !a.layout && a.x === undefined);
        const slabPoints = [];

        floorAssets.forEach(asset => {
            if (asset.type === 'asset_slab') {
                create3DKitchenSlab(asset.x1 * scale, asset.y1 * scale, asset.x2 * scale, asset.y2 * scale, ppf3D, floorGroup, asset, floor);
                slabPoints.push({ x: asset.x1 * scale, z: asset.y1 * scale });
                slabPoints.push({ x: asset.x2 * scale, z: asset.y2 * scale });
            } else if (asset.type === 'asset_stair') {
                if (asset.subType === 'base') {
                    create3DStair(asset.x1 * scale, asset.y1 * scale, asset.x2 * scale, asset.y2 * scale, 0, ppf3D, true, floorGroup, asset, floor);
                } else if (asset.layout || asset.x !== undefined) {
                    create3DStaircase(asset, floorGroup, ppf3D, scale, floor);
                }
            } else if (asset.type === 'asset_pillar') {
                create3DPillar(asset, floorGroup, ppf3D, scale, floor, wallHeight);
            } else if (asset.type.startsWith('furn_')) {
                create3DFurniture(asset, scale, ppf3D, floorGroup, floor);
            }
        });

        // Render MEP Assets on this floor (Electrical, Plumbing & Sanitary)
        const floorMep = floor.mepAssets || (floorIndex === 0 && state.mepAssets) || [];
        floorMep.forEach(mep => {
            if (mep.type === 'mep_overhead_tank') {
                const totalRoofY = (floorsToRender.length * wallHeight) + (0.75 * ppf3D);
                create3DMEPAsset(mep, houseGroup, ppf3D, scale, floor, wallHeight, totalRoofY);
            } else if (mep.type === 'mep_septic_tank') {
                create3DMEPAsset(mep, houseGroup, ppf3D, scale, floor, wallHeight, 0);
            } else {
                create3DMEPAsset(mep, floorGroup, ppf3D, scale, floor, wallHeight, 0);
            }
        });

        slabPoints.forEach(p => {
            const jointGeo = new THREE.BoxGeometry(2 * ppf3D, 0.2 * ppf3D, 2 * ppf3D);
            const jointMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
            const joint = new THREE.Mesh(jointGeo, jointMat);
            joint.position.set(p.x, 3 * ppf3D, p.z);
            joint.castShadow = true;
            joint.receiveShadow = true;
            floorGroup.add(joint);

            const cabGeo = new THREE.BoxGeometry(2 * ppf3D * 0.9, (3 * ppf3D - 0.1 * ppf3D), 2 * ppf3D * 0.9);
            const cabMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
            const cab = new THREE.Mesh(cabGeo, cabMat);
            cab.position.set(p.x, (3 * ppf3D - 0.1 * ppf3D) / 2, p.z);
            floorGroup.add(cab);
        });

        const landingOffset = 1.5 * ppf3D;
        const stepRise = (7 / 12) * ppf3D;

        legacyStairs.forEach((s, idx) => {
            let startHeight = 0;
            let rotationPoint = null;
            let isStartConnected = false;

            for (let i = 0; i < idx; i++) {
                if (Math.hypot(s.x1 - legacyStairs[i].x2, s.y1 - legacyStairs[i].y2) < 2 * state.pixelsPerFoot) {
                    startHeight = legacyStairs[i].calculatedEndY || 0;
                    rotationPoint = { x: s.x1 * scale, z: s.y1 * scale };
                    isStartConnected = true;
                    break;
                }
            }

            let isEndConnected = false;
            for (let k = idx + 1; k < legacyStairs.length; k++) {
                if (Math.hypot(s.x2 - legacyStairs[k].x1, s.y2 - legacyStairs[k].y1) < 2 * state.pixelsPerFoot) {
                    isEndConnected = true;
                    break;
                }
            }

            let x1_3d = s.x1 * scale;
            let z1_3d = s.y1 * scale;
            let x2_3d = s.x2 * scale;
            let z2_3d = s.y2 * scale;
            const angle = Math.atan2(z2_3d - z1_3d, x2_3d - x1_3d);
            const origLength3D = Math.hypot(x2_3d - x1_3d, z2_3d - z1_3d);
            let clipAmount = 0;

            if (isStartConnected) clipAmount += landingOffset;
            if (isEndConnected) clipAmount += landingOffset;

            if (isStartConnected && rotationPoint) {
                const landingWidth = 3 * ppf3D;
                const landingGeo = new THREE.BoxGeometry(landingWidth, stepRise * 2, landingWidth);
                const landingMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
                const landing = new THREE.Mesh(landingGeo, landingMat);
                landing.position.set(rotationPoint.x, startHeight, rotationPoint.z);
                landing.castShadow = true;
                landing.receiveShadow = true;
                floorGroup.add(landing);
            }

            if (origLength3D > clipAmount) {
                if (isStartConnected) { x1_3d += Math.cos(angle) * landingOffset; z1_3d += Math.sin(angle) * landingOffset; }
                if (isEndConnected) { x2_3d -= Math.cos(angle) * landingOffset; z2_3d -= Math.sin(angle) * landingOffset; }
                s.calculatedEndY = create3DStair(x1_3d, z1_3d, x2_3d, z2_3d, startHeight, ppf3D, false, floorGroup, s, floor);
            } else {
                s.calculatedEndY = startHeight;
            }
        });

        // Procedural furniture for rooms if manual furniture was not placed on this floor
        const hasManualFurn = floorAssets.some(a => a.type.startsWith('furn_'));
        if (!hasManualFurn && floor.rooms) {
            floor.rooms.forEach(room => add3DFurniture(room.type, room.x * scale, room.y * scale, scale, floorGroup));
        }

        // Automatic Interior Room Lighting at Night (Warm PointLight + Glowing Ceiling Lamp)
        const roomsToLight = (floor.rooms && floor.rooms.length > 0) ? floor.rooms : (floorIndex === 0 && state.rooms && state.rooms.length > 0 ? state.rooms : []);
        if (roomsToLight.length > 0) {
            roomsToLight.forEach(room => {
                const rx = room.x * scale;
                const rz = room.y * scale;

                // Warm PointLight (color: 0xffe4b5, distance: 60, decay: 1.5) just below ceiling
                const pLight = new THREE.PointLight(0xffe4b5, 0, 60, 1.5);
                pLight.position.set(rx, wallHeight - 1.5, rz);
                floorGroup.add(pLight);

                // Small Glowing Ceiling Fixture Mesh
                const fixtureGeo = new THREE.CylinderGeometry(0.8, 1.0, 0.35, 12);
                const fixtureMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: 0xffe4b5,
                    emissiveIntensity: 0.1,
                    roughness: 0.2
                });
                const fixtureMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
                fixtureMesh.position.set(rx, wallHeight - 0.2, rz);
                floorGroup.add(fixtureMesh);

                interiorLights.push({ light: pLight, fixture: fixtureMesh, floorIndex: floorIndex });
            });
        } else if (state.boundaryPolygon && state.boundaryPolygon.length === 4) {
            // Fallback: place a central ceiling fixture if no specific rooms are assigned yet
            const cx = (state.boundaryPolygon.reduce((s, pt) => s + pt.x, 0) / 4) * scale;
            const cz = (state.boundaryPolygon.reduce((s, pt) => s + pt.y, 0) / 4) * scale;

            const pLight = new THREE.PointLight(0xffe4b5, 0, 70, 1.5);
            pLight.position.set(cx, wallHeight - 1.5, cz);
            floorGroup.add(pLight);

            const fixtureGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.4, 12);
            const fixtureMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0xffe4b5,
                emissiveIntensity: 0.1,
                roughness: 0.2
            });
            const fixtureMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
            fixtureMesh.position.set(cx, wallHeight - 0.2, cz);
            floorGroup.add(fixtureMesh);

            interiorLights.push({ light: pLight, fixture: fixtureMesh, floorIndex: floorIndex });
        }

        // Render Exterior Chajjas / Cantilever Canopies on this floor
        const floorChajjas = floor.chajjas || [];
        if (floorChajjas.length > 0 && state.boundaryPolygon.length === 4) {
            const p = state.boundaryPolygon;
            const chajjaMat = new THREE.MeshStandardMaterial({
                color: 0xe5e7eb,
                roughness: 0.8,
                metalness: 0.05
            });
            const chajjaThickness = 0.25 * ppf3D; // Standard 3-inch thick concrete canopy slab

            floorChajjas.forEach(ch => {
                let A, B;
                if (ch.side === 'front') { A = p[0]; B = p[1]; }
                else if (ch.side === 'right') { A = p[1]; B = p[2]; }
                else if (ch.side === 'back') { A = p[2]; B = p[3]; }
                else if (ch.side === 'left') { A = p[3]; B = p[0]; }
                if (!A || !B) return;

                const ax = A.x * scale, az = A.y * scale;
                const bx = B.x * scale, bz = B.y * scale;
                const dx = bx - ax, dz = bz - az;
                const len = Math.hypot(dx, dz);
                if (len < 0.5) return;

                const tx = dx / len, tz = dz / len;
                const nx = -tz, nz = tx;
                const ext = (ch.depth || 3) * ppf3D;

                const c1 = { x: ax, y: az };
                const c2 = { x: bx, y: bz };
                const c3 = { x: bx + nx * ext, y: bz + nz * ext };
                const c4 = { x: ax + nx * ext, y: az + nz * ext };

                const chShape = new THREE.Shape();
                chShape.moveTo(c1.x, c1.y);
                chShape.lineTo(c2.x, c2.y);
                chShape.lineTo(c3.x, c3.y);
                chShape.lineTo(c4.x, c4.y);
                chShape.closePath();

                const chGeo = new THREE.ExtrudeGeometry(chShape, {
                    depth: chajjaThickness,
                    bevelEnabled: false
                });

                const chMesh = new THREE.Mesh(chGeo, chajjaMat);
                chMesh.rotation.x = Math.PI / 2;
                const targetY = (ch.level === 'lintel') ? (7 * ppf3D) : wallHeight;
                chMesh.position.y = targetY;
                chMesh.castShadow = true;
                chMesh.receiveShadow = true;
                floorGroup.add(chMesh);

                // Drip fascia lip along the outer edge of the chajja
                const dripGeo = new THREE.BoxGeometry(len, 0.18 * ppf3D, 0.08 * ppf3D);
                const dripMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 });
                const dripMesh = new THREE.Mesh(dripGeo, dripMat);
                const angle = Math.atan2(dz, dx);
                dripMesh.rotation.y = -angle;
                const midLipX = (c3.x + c4.x) / 2;
                const midLipZ = (c3.y + c4.y) / 2;
                dripMesh.position.set(midLipX, targetY - (chajjaThickness / 2), midLipZ);
                dripMesh.castShadow = true;
                floorGroup.add(dripMesh);
            });
        }

        houseGroup.add(floorGroup);

        // Guaranteed Stairwell Ceiling / Roof Slab with Cutout
        const isTopFloor = (floorIndex === floorsToRender.length - 1);
        const floorStairs = (floor.assets || []).filter(a => a.type === 'asset_stair' && (a.subType === 'main' || a.layout || a.x !== undefined) && a.subType !== 'base' && a.autoCutout !== false);
        const shouldRenderSlab = !isTopFloor || state.showRoof || floorStairs.length > 0;

        if (shouldRenderSlab && state.boundaryPolygon && state.boundaryPolygon.length === 4) {
            const p = state.boundaryPolygon;
            const roofShape = new THREE.Shape();
            roofShape.moveTo(p[0].x * scale, p[0].y * scale);
            roofShape.lineTo(p[1].x * scale, p[1].y * scale);
            roofShape.lineTo(p[2].x * scale, p[2].y * scale);
            roofShape.lineTo(p[3].x * scale, p[3].y * scale);
            roofShape.closePath();

            // Calculate exact staircase footprint & cut the hole(s)
            addStairVoidHoles(roofShape, floorStairs, scale, ppf3D, p);

            let roofGeo;
            try {
                roofGeo = new THREE.ExtrudeGeometry(roofShape, {
                    depth: 0.75 * ppf3D,
                    bevelEnabled: false
                });
            } catch (err) {
                console.warn('Triangulation fallback for ceiling/roof slab:', err);
                const fallbackRoof = new THREE.Shape();
                fallbackRoof.moveTo(p[0].x * scale, p[0].y * scale);
                fallbackRoof.lineTo(p[1].x * scale, p[1].y * scale);
                fallbackRoof.lineTo(p[2].x * scale, p[2].y * scale);
                fallbackRoof.lineTo(p[3].x * scale, p[3].y * scale);
                fallbackRoof.closePath();
                roofGeo = new THREE.ExtrudeGeometry(fallbackRoof, {
                    depth: 0.75 * ppf3D,
                    bevelEnabled: false
                });
            }

            const isTopFloor = (floorIndex === floorsToRender.length - 1);
            let slabMatId = null;
            if (isTopFloor) {
                slabMatId = floor.floorMaterial || state.floorMaterial;
            } else if (floorIndex + 1 < floorsToRender.length) {
                slabMatId = floorsToRender[floorIndex + 1].floorMaterial || floor.floorMaterial || state.floorMaterial;
            } else {
                slabMatId = floor.floorMaterial || state.floorMaterial;
            }

            const roofMat = slabMatId ? getThreeMaterial(slabMatId) : new THREE.MeshStandardMaterial({
                color: isTopFloor ? 0xc8b69e : 0xd4b28c,
                roughness: isTopFloor ? 0.45 : 0.35,
                metalness: 0.05,
                side: THREE.DoubleSide
            });
            const roofMesh = new THREE.Mesh(roofGeo, roofMat);
            roofMesh.rotation.x = Math.PI / 2;
            roofMesh.position.y = floorBaseY + wallHeight + (0.75 * ppf3D);
            roofMesh.receiveShadow = true;
            roofMesh.castShadow = true;
            roofMesh.userData = {
                isRoofSlab: true,
                isFloorSlab: true,
                floorIndex: floorIndex,
                floor: (floorIndex + 1 < floorsToRender.length) ? floorsToRender[floorIndex + 1] : floor
            };
            houseGroup.add(roofMesh);
        }
    });

    // Disable frustum culling on all meshes so upper floors and stacked objects never disappear
    disableFrustumCulling(houseGroup);

    // Keep 3D transform handles synchronized with selected object
    update3DGizmoPosition();

    // Synchronize Sun / Moon and Interior Lighting Simulation with current hour
    updateSunSimulation(currentSimHour);
}

function toggleRoof() {
    state.showRoof = !state.showRoof;
    const btn = document.getElementById('btn-toggle-roof');
    if (btn) {
        if (state.showRoof) {
            btn.classList.add('bg-blue-100', 'text-blue-700');
            btn.classList.remove('bg-white', 'text-gray-700');
        } else {
            btn.classList.remove('bg-blue-100', 'text-blue-700');
            btn.classList.add('bg-white', 'text-gray-700');
        }
    }
    if (typeof generate3D === 'function') generate3D();
}

// ============================================================================
// Real-Time Day/Night Lighting & Sun Shadow Simulator
// ============================================================================

function updateSunSimulation(hour) {
    let h = parseFloat(hour);
    if (isNaN(h)) h = 12.0;
    h = Math.max(0, Math.min(24, h));
    currentSimHour = h;
    if (state.sunSimulation) {
        state.sunSimulation.hour = h;
    }

    // 1. East-to-West Sun Arc (6:00 AM to 6:00 PM) or Night Moon Arc
    if (h >= 6.0 && h <= 18.0) {
        // Day sun arc: theta in [0, PI]
        const theta = ((h - 6.0) / 12.0) * Math.PI;
        const R = 300;
        const sunX = Math.cos(theta) * R;  // East (+X) at 6 AM -> Overhead (0) at 12 PM -> West (-X) at 6 PM
        const sunY = Math.sin(theta) * R;  // Horizon (0) -> Peak (300) at Noon -> Horizon (0)
        const sunZ = 80;                   // Slight southern seasonal tilt for architectural depth

        if (dirLight) {
            dirLight.position.set(sunX, Math.max(10, sunY), sunZ);
            dirLight.target.position.set(0, 0, 0);
            dirLight.target.updateMatrixWorld();
        }
        if (sunSphere) {
            sunSphere.position.set(sunX, Math.max(10, sunY), sunZ);
            sunSphere.scale.setScalar(1.0);
            sunSphere.visible = true;
        }
    } else {
        // Night moon arc: progress over the 12-hour night
        const nightProgress = h >= 18.0 ? (h - 18.0) / 12.0 : (h + 6.0) / 12.0;
        const moonTheta = nightProgress * Math.PI;
        const moonR = 280;
        const moonX = Math.cos(moonTheta) * moonR;
        const moonY = Math.sin(moonTheta) * 200 + 40; // High overhead in the night sky
        const moonZ = -80;

        if (dirLight) {
            dirLight.position.set(moonX, Math.max(25, moonY), moonZ);
            dirLight.target.position.set(0, 0, 0);
            dirLight.target.updateMatrixWorld();
        }
        if (sunSphere) {
            sunSphere.position.set(moonX, moonY, moonZ);
            sunSphere.scale.setScalar(0.75);
            sunSphere.visible = true;
        }
    }

    // 2. Dynamic Sky, Fog & Color Temperature Transitions
    const sunKeyframes = [
        { hour: 0.0,  sky: 0x0b132b, light: 0x64748b, dirInt: 0.20, hemiInt: 0.15, ambInt: 0.10 },
        { hour: 5.0,  sky: 0x0b132b, light: 0x64748b, dirInt: 0.20, hemiInt: 0.15, ambInt: 0.10 },
        { hour: 6.5,  sky: 0xfd9e6c, light: 0xff7b00, dirInt: 0.70, hemiInt: 0.40, ambInt: 0.30 },
        { hour: 8.0,  sky: 0xa0c4ff, light: 0xfff5b6, dirInt: 1.00, hemiInt: 0.65, ambInt: 0.45 },
        { hour: 16.5, sky: 0xa0c4ff, light: 0xfff5b6, dirInt: 1.00, hemiInt: 0.65, ambInt: 0.45 },
        { hour: 18.0, sky: 0xfd9e6c, light: 0xff7b00, dirInt: 0.70, hemiInt: 0.40, ambInt: 0.30 },
        { hour: 19.5, sky: 0x0b132b, light: 0x64748b, dirInt: 0.20, hemiInt: 0.15, ambInt: 0.10 },
        { hour: 24.0, sky: 0x0b132b, light: 0x64748b, dirInt: 0.20, hemiInt: 0.15, ambInt: 0.10 }
    ];

    let k1 = sunKeyframes[0], k2 = sunKeyframes[1];
    for (let i = 0; i < sunKeyframes.length - 1; i++) {
        if (h >= sunKeyframes[i].hour && h <= sunKeyframes[i + 1].hour) {
            k1 = sunKeyframes[i];
            k2 = sunKeyframes[i + 1];
            break;
        }
    }
    const span = (k2.hour - k1.hour) || 1;
    const t = Math.max(0, Math.min(1, (h - k1.hour) / span));

    const skyColor = new THREE.Color(k1.sky).lerp(new THREE.Color(k2.sky), t);
    const lightColor = new THREE.Color(k1.light).lerp(new THREE.Color(k2.light), t);
    const dirIntensity = k1.dirInt + (k2.dirInt - k1.dirInt) * t;
    const hemiIntensity = k1.hemiInt + (k2.hemiInt - k1.hemiInt) * t;
    const ambIntensity = k1.ambInt + (k2.ambInt - k1.ambInt) * t;

    if (scene) {
        scene.background = skyColor;
        if (scene.fog) scene.fog.color.copy(skyColor);
    }
    if (dirLight) {
        dirLight.color.copy(lightColor);
        dirLight.intensity = dirIntensity;
    }
    if (hemiLight) {
        hemiLight.intensity = hemiIntensity;
    }
    if (ambLight) {
        ambLight.intensity = ambIntensity;
    }
    if (sunSphere && sunSphere.material) {
        const isDay = (h >= 6.0 && h <= 18.0);
        sunSphere.material.color.copy(isDay ? lightColor : new THREE.Color(0xe2e8f0));
    }

    // 3. Automatic Interior Room Lighting at Night
    const isNightTime = (h < 6.5 || h >= 18.0);
    let lightsActive = false;
    if (interiorLightsManual === true) {
        lightsActive = true;
    } else if (interiorLightsManual === false) {
        lightsActive = false;
    } else {
        lightsActive = isNightTime;
    }

    const pointIntensity = lightsActive ? 0.85 : 0.0;
    const emissiveIntensity = lightsActive ? 1.0 : 0.08;

    interiorLights.forEach(item => {
        if (item.light) item.light.intensity = pointIntensity;
        if (item.fixture && item.fixture.material) {
            item.fixture.material.emissiveIntensity = emissiveIntensity;
        }
    });

    // 4. Update UI Time Badge & Controls
    const totalMinutes = Math.round(h * 60) % 1440;
    const hrs24 = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const padMins = mins < 10 ? '0' + mins : mins;
    const ampm = hrs24 >= 12 ? 'PM' : 'AM';
    let hrs12 = hrs24 % 12;
    if (hrs12 === 0) hrs12 = 12;
    const padHrs = hrs12 < 10 ? '0' + hrs12 : hrs12;
    const timeStr = `${padHrs}:${padMins} ${ampm}`;

    let phaseStr = 'Day';
    if (h >= 5.0 && h < 7.5) phaseStr = 'Sunrise';
    else if (h >= 7.5 && h < 11.5) phaseStr = 'Morning';
    else if (h >= 11.5 && h < 13.5) phaseStr = 'Noon';
    else if (h >= 13.5 && h < 17.0) phaseStr = 'Afternoon';
    else if (h >= 17.0 && h < 19.0) phaseStr = 'Sunset';
    else if (h >= 19.0 && h < 22.0) phaseStr = 'Evening';
    else phaseStr = 'Night';

    const timeDisplay = document.getElementById('sun-time-display');
    const phaseDisplay = document.getElementById('sun-phase-display');
    const badgeIcon = document.getElementById('sun-badge-icon');
    const iconContainer = document.getElementById('sun-icon-container');

    if (timeDisplay) timeDisplay.innerText = `${timeStr} - ${phaseStr}`;
    if (phaseDisplay) phaseDisplay.innerText = phaseStr.toUpperCase();

    if (badgeIcon && iconContainer) {
        if (phaseStr === 'Night') {
            badgeIcon.className = "fa-solid fa-moon text-indigo-300";
            iconContainer.className = "w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-lg shadow-inner";
            if (phaseDisplay) phaseDisplay.className = "text-[10px] font-semibold text-indigo-300 uppercase tracking-wider";
        } else if (phaseStr === 'Sunrise' || phaseStr === 'Sunset') {
            badgeIcon.className = "fa-solid fa-cloud-sun text-orange-400";
            iconContainer.className = "w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center text-lg shadow-inner";
            if (phaseDisplay) phaseDisplay.className = "text-[10px] font-semibold text-orange-300 uppercase tracking-wider";
        } else if (phaseStr === 'Noon') {
            badgeIcon.className = "fa-solid fa-sun text-yellow-300";
            iconContainer.className = "w-9 h-9 rounded-xl bg-yellow-500/25 text-yellow-300 flex items-center justify-center text-lg shadow-inner";
            if (phaseDisplay) phaseDisplay.className = "text-[10px] font-semibold text-yellow-300 uppercase tracking-wider";
        } else {
            badgeIcon.className = "fa-solid fa-sun text-amber-400";
            iconContainer.className = "w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shadow-inner";
            if (phaseDisplay) phaseDisplay.className = "text-[10px] font-semibold text-amber-300 uppercase tracking-wider";
        }
    }

    const slider = document.getElementById('sun-time-slider');
    if (slider && Math.abs(parseFloat(slider.value) - h) > 0.05) {
        slider.value = String(h);
    }

    // Preset button styling
    const presets = [
        { id: 'sun-btn-morning', h: 7.0, activeClass: 'bg-amber-500 text-gray-900 shadow-sm' },
        { id: 'sun-btn-noon',    h: 12.0, activeClass: 'bg-yellow-400 text-gray-900 shadow-sm' },
        { id: 'sun-btn-evening', h: 17.5, activeClass: 'bg-orange-500 text-white shadow-sm' },
        { id: 'sun-btn-night',   h: 21.0, activeClass: 'bg-indigo-600 text-white shadow-sm' }
    ];
    presets.forEach(p => {
        const btn = document.getElementById(p.id);
        if (!btn) return;
        const isMatch = Math.abs(h - p.h) < 0.35;
        if (isMatch) {
            btn.className = `px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${p.activeClass}`;
        } else {
            btn.className = "px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-gray-200 transition cursor-pointer flex items-center gap-1";
        }
    });

    // Interior lights button styling
    const lightBtn = document.getElementById('btn-toggle-interior-lights');
    const lightIcon = document.getElementById('interior-lights-icon');
    const lightText = document.getElementById('interior-lights-text');
    if (lightBtn && lightText && lightIcon) {
        if (interiorLightsManual === true) {
            lightBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-gray-900 transition cursor-pointer flex items-center gap-1.5 shadow-sm";
            lightIcon.className = "fa-solid fa-lightbulb text-gray-900";
            lightText.innerText = "Lights: ON";
        } else if (interiorLightsManual === false) {
            lightBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 text-gray-400 transition cursor-pointer flex items-center gap-1.5 border border-white/10";
            lightIcon.className = "fa-regular fa-lightbulb text-gray-500";
            lightText.innerText = "Lights: OFF";
        } else {
            if (lightsActive) {
                lightBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 transition cursor-pointer flex items-center gap-1.5 border border-amber-500/30";
                lightIcon.className = "fa-solid fa-lightbulb text-amber-400";
                lightText.innerText = "Lights: Auto (ON)";
            } else {
                lightBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 text-gray-300 transition cursor-pointer flex items-center gap-1.5 border border-white/10";
                lightIcon.className = "fa-regular fa-lightbulb text-gray-400";
                lightText.innerText = "Lights: Auto (OFF)";
            }
        }
    }
}

function setSunPreset(hour) {
    updateSunSimulation(hour);
}

function toggleInteriorLights() {
    if (interiorLightsManual === null) {
        interiorLightsManual = true;
    } else if (interiorLightsManual === true) {
        interiorLightsManual = false;
    } else {
        interiorLightsManual = null;
    }
    if (state.sunSimulation) {
        state.sunSimulation.interiorLightsManual = interiorLightsManual;
    }
    updateSunSimulation(currentSimHour);
}

window.updateSunSimulation = updateSunSimulation;
window.setSunPreset = setSunPreset;
window.toggleInteriorLights = toggleInteriorLights;

function add3DFurniture(roomType, cx, cz, scale, parentGroup = houseGroup) {
    const ppf3D = state.pixelsPerFoot * scale;
    if (roomType === 'Master Bedroom' || roomType === 'Bedroom') {
        const bedLen = (roomType === 'Master Bedroom' ? 6.5 : 5.5) * ppf3D;
        const bedDepth = (roomType === 'Master Bedroom' ? 6.5 : 4.5) * ppf3D;
        const group = new THREE.Group();
        const bedWood = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });
        const bed = new THREE.Mesh(new THREE.BoxGeometry(bedLen, 1.5 * ppf3D, bedDepth), bedWood);
        bed.position.y = (1.5 * ppf3D) / 2;
        const mattress = new THREE.Mesh(new THREE.BoxGeometry(bedLen * 0.92, 0.6 * ppf3D, bedDepth * 0.92), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
        mattress.position.set(0, 1.5 * ppf3D + (0.6 * ppf3D) / 2, 0);
        const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedLen, 3.2 * ppf3D, 0.3 * ppf3D), bedWood);
        headboard.position.set(0, 1.6 * ppf3D, -bedDepth / 2 + 0.15 * ppf3D);
        group.add(bed, mattress, headboard);
        group.position.set(cx, 0, cz);
        group.children.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
        parentGroup.add(group);
    } else if (roomType === 'Living Room') {
        const group = new THREE.Group();
        const sofaLen = 7 * ppf3D;
        const sofaDepth = 2.8 * ppf3D;
        const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.8 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(sofaLen, 1.2 * ppf3D, sofaDepth), sofaMat);
        base.position.y = (1.2 * ppf3D) / 2;
        const back = new THREE.Mesh(new THREE.BoxGeometry(sofaLen, 2.5 * ppf3D, 0.5 * ppf3D), sofaMat);
        back.position.set(0, (2.5 * ppf3D) / 2, -sofaDepth / 2 + 0.25 * ppf3D);
        const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.5 * ppf3D, 2 * ppf3D, sofaDepth), sofaMat);
        arm1.position.set(-sofaLen / 2 + 0.25 * ppf3D, ppf3D, 0);
        const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.5 * ppf3D, 2 * ppf3D, sofaDepth), sofaMat);
        arm2.position.set(sofaLen / 2 - 0.25 * ppf3D, ppf3D, 0);
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
        const table = new THREE.Mesh(new THREE.BoxGeometry(3.5 * ppf3D, 0.8 * ppf3D, 2 * ppf3D), tableMat);
        table.position.set(0, 0.4 * ppf3D, sofaDepth / 2 + 1.8 * ppf3D);
        group.add(base, back, arm1, arm2, table);
        group.position.set(cx, 0, cz);
        group.children.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
        parentGroup.add(group);
    } else if (roomType === 'Pooja Room') {
        const group = new THREE.Group();
        const altarMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
        const altar = new THREE.Mesh(new THREE.BoxGeometry(3 * ppf3D, 2 * ppf3D, 2 * ppf3D), altarMat);
        altar.position.set(0, ppf3D, 0);
        const dome = new THREE.Mesh(new THREE.ConeGeometry(1 * ppf3D, 1.5 * ppf3D, 8), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3 }));
        dome.position.set(0, 2.75 * ppf3D, 0);
        group.add(altar, dome);
        group.position.set(cx, 0, cz);
        group.children.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
        parentGroup.add(group);
    } else if (roomType === 'Bathroom') {
        const group = new THREE.Group();
        const vanityMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
        const vanity = new THREE.Mesh(new THREE.BoxGeometry(2.5 * ppf3D, 2.6 * ppf3D, 1.8 * ppf3D), vanityMat);
        vanity.position.set(0, 1.3 * ppf3D, 0);
        const sink = new THREE.Mesh(new THREE.BoxGeometry(1.6 * ppf3D, 0.3 * ppf3D, 1.2 * ppf3D), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        sink.position.set(0, 2.75 * ppf3D, 0);
        group.add(vanity, sink);
        group.position.set(cx, 0, cz);
        group.children.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
        parentGroup.add(group);
    }
}

function create3DFurniture(asset, scale, ppf3D, parentGroup = houseGroup, floor = null) {
    const x1 = asset.x1 * scale;
    const z1 = asset.y1 * scale;
    const x2 = asset.x2 * scale;
    const z2 = asset.y2 * scale;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const group = new THREE.Group();

    let cx = (x1 + x2) / 2;
    let cz = (z1 + z2) / 2;

    if (asset.type === 'furn_bed') {
        const depth = 6 * ppf3D;
        cx += Math.cos(angle + Math.PI / 2) * (depth / 2);
        cz += Math.sin(angle + Math.PI / 2) * (depth / 2);

        const bedWood = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const bed = new THREE.Mesh(new THREE.BoxGeometry(len, 1.5 * ppf3D, depth), bedWood);
        bed.position.y = (1.5 * ppf3D) / 2;
        const mattress = new THREE.Mesh(new THREE.BoxGeometry(len * 0.9, 0.6 * ppf3D, depth * 0.95), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        mattress.position.set(0, 1.5 * ppf3D + (0.6 * ppf3D) / 2, depth * 0.02);
        const headboard = new THREE.Mesh(new THREE.BoxGeometry(len, 3 * ppf3D, 0.2 * ppf3D), bedWood);
        headboard.position.set(0, 1.5 * ppf3D, -depth / 2 + 0.1 * ppf3D);
        group.add(bed, mattress, headboard);
    } else if (asset.type === 'furn_almira') {
        const depth = 2 * ppf3D;
        cx += Math.cos(angle + Math.PI / 2) * (depth / 2);
        cz += Math.sin(angle + Math.PI / 2) * (depth / 2);

        const isFull = asset.subType === 'full';
        const baseHeight = 8 * ppf3D;
        const alMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 });
        const alBase = new THREE.Mesh(new THREE.BoxGeometry(len, baseHeight, depth), alMat);
        alBase.position.y = baseHeight / 2;
        group.add(alBase);

        if (isFull) {
            const loftHeight = 3 * ppf3D;
            const loftMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
            const loft = new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, loftHeight, depth * 0.98), loftMat);
            loft.position.y = baseHeight + loftHeight / 2;
            group.add(loft);
        }
    } else if (asset.type === 'furn_sofa') {
        const depth = 2.5 * ppf3D;
        cx += Math.cos(angle + Math.PI / 2) * (depth / 2);
        cz += Math.sin(angle + Math.PI / 2) * (depth / 2);

        const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2 * ppf3D, depth), sofaMat);
        base.position.y = (1.2 * ppf3D) / 2;
        const back = new THREE.Mesh(new THREE.BoxGeometry(len, 2.5 * ppf3D, 0.5 * ppf3D), sofaMat);
        back.position.set(0, (2.5 * ppf3D) / 2, -depth / 2 + 0.25 * ppf3D);
        const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.5 * ppf3D, 2 * ppf3D, depth), sofaMat);
        arm1.position.set(-len / 2 + 0.25 * ppf3D, ppf3D, 0);
        const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.5 * ppf3D, 2 * ppf3D, depth), sofaMat);
        arm2.position.set(len / 2 - 0.25 * ppf3D, ppf3D, 0);
        group.add(base, back, arm1, arm2);
    } else if (asset.type === 'furn_dining') {
        const depth = 3 * ppf3D;
        cx += Math.cos(angle + Math.PI / 2) * (depth / 2);
        cz += Math.sin(angle + Math.PI / 2) * (depth / 2);

        const tableMat = new THREE.MeshStandardMaterial({ color: 0xd97706 });
        const tableTop = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2 * ppf3D, depth), tableMat);
        tableTop.position.y = 2.5 * ppf3D;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(len * 0.6, 2.4 * ppf3D, depth * 0.4), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
        leg.position.y = 1.2 * ppf3D;
        group.add(tableTop, leg);

        const chairMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const numChairs = Math.max(1, Math.floor(len / (1.5 * ppf3D)));
        const spacing = len / numChairs;
        for (let i = 0; i < numChairs; i++) {
            const chX = -len / 2 + spacing / 2 + i * spacing;
            const c1 = new THREE.Mesh(new THREE.BoxGeometry(ppf3D, 1.5 * ppf3D, ppf3D), chairMat);
            c1.position.set(chX, 0.75 * ppf3D, -depth / 2 - 0.5 * ppf3D);
            const c2 = new THREE.Mesh(new THREE.BoxGeometry(ppf3D, 1.5 * ppf3D, ppf3D), chairMat);
            c2.position.set(chX, 0.75 * ppf3D, depth / 2 + 0.5 * ppf3D);
            group.add(c1, c2);
        }
    }

    group.position.set(cx, 0, cz);
    group.rotation.y = -angle;
    group.userData = { item: asset, floor: floor, type: asset.type };
    group.children.forEach(m => {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData = { item: asset, floor: floor, type: asset.type };
    });
    parentGroup.add(group);
}

function create3DKitchenSlab(x1, z1, x2, z2, ppf3D, parentGroup = houseGroup, asset = null, floor = null) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const slabWidth = 2 * ppf3D;
    const slabHeight = 0.2 * ppf3D;
    const renderY = 3 * ppf3D;

    const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(length, slabHeight, slabWidth), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    slabMesh.position.set(centerX, renderY, centerZ);
    slabMesh.rotation.y = -angle;
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    if (asset) slabMesh.userData = { item: asset, floor: floor, type: 'asset_slab' };
    parentGroup.add(slabMesh);

    const cabMesh = new THREE.Mesh(new THREE.BoxGeometry(length, renderY - slabHeight / 2, slabWidth * 0.9), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
    cabMesh.position.set(centerX, (renderY - slabHeight / 2) / 2, centerZ);
    cabMesh.rotation.y = -angle;
    cabMesh.castShadow = true;
    cabMesh.receiveShadow = true;
    if (asset) cabMesh.userData = { item: asset, floor: floor, type: 'asset_slab' };
    parentGroup.add(cabMesh);
}

function create3DPillar(asset, parentGroup, ppf3D, scale, floor, wallHeight) {
    const isQuad = (asset.subType !== 'circle');
    const cx = asset.x * scale;
    const cz = asset.y * scale;
    const cy = wallHeight / 2;
    const rotRad = - ((asset.rotation || 0) * Math.PI) / 180;

    let pillarGeo;
    if (isQuad) {
        const w3D = (asset.w || 1.0) * ppf3D;
        const d3D = (asset.d || 2.0) * ppf3D;
        pillarGeo = new THREE.BoxGeometry(w3D, wallHeight, d3D);
    } else {
        const r3D = (asset.radius || 0.75) * ppf3D;
        pillarGeo = new THREE.CylinderGeometry(r3D, r3D, wallHeight, 16);
    }

    const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x64748b, // Architectural slate concrete
        roughness: 0.65,
        metalness: 0.08
    });

    const mesh = new THREE.Mesh(pillarGeo, pillarMat);
    mesh.position.set(cx, cy, cz);
    mesh.rotation.y = rotRad;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData = {
        isEditable: true,
        item: asset,
        floor: floor,
        type: 'asset_pillar',
        label: isQuad ? `Structural Pillar (${asset.w || 1}x${asset.d || 2}')` : `Circular Column (ø${asset.diameter || 1.5}')`
    };

    parentGroup.add(mesh);

    const baseY = (parentGroup && parentGroup.position) ? parentGroup.position.y : 0;
    const pRadius = isQuad ? Math.max((asset.w || 1.0) * ppf3D, (asset.d || 2.0) * ppf3D) / 2 : (asset.radius || 0.75) * ppf3D;
    const pBox = new THREE.Box3(
        new THREE.Vector3(cx - pRadius, baseY, cz - pRadius),
        new THREE.Vector3(cx + pRadius, baseY + wallHeight, cz + pRadius)
    );
    collidableWalls.push({
        box: pBox,
        x1: cx, z1: cz,
        x2: cx, z2: cz,
        baseY: baseY,
        topY: baseY + wallHeight,
        thickness: pRadius * 2,
        isDoor: false,
        type: 'pillar'
    });
}

function create3DStaircase(asset, parentGroup, ppf3D, scale, floor) {
    const layout = asset.layout || 'u_shape';
    const numSteps = asset.numSteps || 20;
    const fwFt = asset.flightWidthFt || 3.0;
    const fw = fwFt * ppf3D;
    const totalHeight = 11.0 * ppf3D; // Standard building height 11 ft
    const riserHeight = totalHeight / numSteps;

    const stairGroup = new THREE.Group();
    const cx = (asset.x !== undefined ? asset.x : (asset.x1 + asset.x2) / 2) * scale;
    const cz = (asset.y !== undefined ? asset.y : (asset.y1 + asset.y2) / 2) * scale;
    stairGroup.position.set(cx, 0, cz);
    stairGroup.rotation.y = -((asset.rotation || 0) * Math.PI) / 180;
    if (asset.flip) {
        stairGroup.scale.x = -1;
    }

    // High quality architectural materials
    const treadMat = new THREE.MeshStandardMaterial({
        color: 0xa16207, // Warm polished teak wood
        roughness: 0.4,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    const riserMat = new THREE.MeshStandardMaterial({
        color: 0x334155, // Architectural slate
        roughness: 0.7,
        side: THREE.DoubleSide
    });
    const railMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b, // Stainless dark charcoal metal
        roughness: 0.3,
        metalness: 0.8,
        side: THREE.DoubleSide
    });
    const landingMat = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        roughness: 0.5,
        side: THREE.DoubleSide
    });

    const treadNosing = 0.08 * ppf3D;
    const treadThickness = 0.15 * ppf3D;
    const railHeight = 3.0 * ppf3D; // 3 ft railing
    const postRadius = 0.06 * ppf3D;
    const railRadius = 0.07 * ppf3D;

    function addStep(x, y, z, width, treadDepth) {
        const stepGroup = new THREE.Group();
        // Riser
        const riserGeo = new THREE.BoxGeometry(width, riserHeight, 0.08 * ppf3D);
        const riserMesh = new THREE.Mesh(riserGeo, riserMat);
        riserMesh.position.set(0, riserHeight / 2, -treadDepth / 2);
        riserMesh.castShadow = true;
        riserMesh.receiveShadow = true;
        stepGroup.add(riserMesh);

        // Tread
        const treadGeo = new THREE.BoxGeometry(width + treadNosing * 0.5, treadThickness, treadDepth + treadNosing);
        const treadMesh = new THREE.Mesh(treadGeo, treadMat);
        treadMesh.position.set(0, riserHeight - treadThickness / 2, 0);
        treadMesh.castShadow = true;
        treadMesh.receiveShadow = true;
        stepGroup.add(treadMesh);

        stepGroup.position.set(x, y, z);
        stepGroup.userData = { item: asset, floor: floor, type: 'asset_stair' };
        riserMesh.userData = { item: asset, floor: floor, type: 'asset_stair' };
        treadMesh.userData = { item: asset, floor: floor, type: 'asset_stair' };
        stairGroup.add(stepGroup);
    }

    function addRailingPost(x, y, z) {
        const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, railHeight, 8);
        const post = new THREE.Mesh(postGeo, railMat);
        post.position.set(x, y + railHeight / 2, z);
        post.castShadow = true;
        post.userData = { item: asset, floor: floor, type: 'asset_stair' };
        stairGroup.add(post);
    }

    function addHandrail(x1, y1, z1, x2, y2, z2) {
        const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
        const len = Math.hypot(dx, dy, dz);
        if (len < 0.1) return;
        const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, len, 8);
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);

        const axis = new THREE.Vector3(dx, dy, dz).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, axis);
        rail.setRotationFromQuaternion(quat);

        rail.castShadow = true;
        rail.userData = { item: asset, floor: floor, type: 'asset_stair' };
        stairGroup.add(rail);
    }

    if (layout === 'u_shape') {
        const wellGapFt = 0.5;
        const wellGap = wellGapFt * ppf3D;
        const totalW = fw * 2 + wellGap;
        const treadsPerFlight = Math.max(1, Math.floor(numSteps / 2) - 1);
        const treadFt = 10 / 12;
        const treadDepth = treadFt * ppf3D;
        const flightRun = treadsPerFlight * treadDepth;
        const landingDepth = 3.0 * ppf3D;
        const totalL = landingDepth + flightRun;

        const leftX = -totalW / 2;
        const topZ = -totalL / 2;
        const f1CenterX = leftX + fw / 2;
        const f2CenterX = leftX + fw + wellGap + fw / 2;
        const landingZ = topZ + landingDepth / 2;
        const landingElevation = (numSteps / 2) * riserHeight; // 5.5 ft

        // 1. Mid-Landing Slab at 5.5 ft
        const landingGeo = new THREE.BoxGeometry(totalW, riserHeight * 1.2, landingDepth);
        const landingMesh = new THREE.Mesh(landingGeo, landingMat);
        landingMesh.position.set(0, landingElevation - (riserHeight * 0.6), landingZ);
        landingMesh.castShadow = true;
        landingMesh.receiveShadow = true;
        landingMesh.userData = { item: asset, floor: floor, type: 'asset_stair' };
        stairGroup.add(landingMesh);

        // Landing outer railing
        addRailingPost(-totalW / 2 + postRadius, landingElevation, topZ + postRadius);
        addRailingPost(totalW / 2 - postRadius, landingElevation, topZ + postRadius);
        addHandrail(
            -totalW / 2 + postRadius, landingElevation + railHeight, topZ + postRadius,
            totalW / 2 - postRadius, landingElevation + railHeight, topZ + postRadius
        );

        // 2. Flight 1 Steps: Bottom to Mid-Landing (Y: 0 -> landingElevation)
        for (let i = 0; i < treadsPerFlight; i++) {
            const sz = topZ + totalL - (i * treadDepth + treadDepth / 2);
            const sy = i * riserHeight;
            addStep(f1CenterX, sy, sz, fw, treadDepth);
        }

        // Flight 1 Outer Railing
        const f1BottomZ = topZ + totalL;
        const f1TopZ = topZ + landingDepth;
        const f1OuterX = leftX + postRadius;
        addRailingPost(f1OuterX, 0, f1BottomZ);
        addRailingPost(f1OuterX, landingElevation, f1TopZ);
        addHandrail(f1OuterX, railHeight, f1BottomZ, f1OuterX, landingElevation + railHeight, f1TopZ);

        // 3. Flight 2 Steps: Mid-Landing to Upper Floor (Y: landingElevation -> totalHeight)
        for (let i = 0; i < treadsPerFlight; i++) {
            const sz = topZ + landingDepth + (i * treadDepth + treadDepth / 2);
            const sy = landingElevation + (i * riserHeight);
            addStep(f2CenterX, sy, sz, fw, treadDepth);
        }

        // Flight 2 Outer Railing
        const f2OuterX = totalW / 2 - postRadius;
        addRailingPost(f2OuterX, landingElevation, f1TopZ);
        addRailingPost(f2OuterX, totalHeight, f1BottomZ);
        addHandrail(f2OuterX, landingElevation + railHeight, f1TopZ, f2OuterX, totalHeight + railHeight, f1BottomZ);

        // Well Inner Railing
        const wellLeftX = -wellGap / 2;
        const wellRightX = wellGap / 2;
        addRailingPost(wellLeftX, landingElevation, f1TopZ);
        addRailingPost(wellRightX, landingElevation, f1TopZ);
        addHandrail(wellLeftX, landingElevation + railHeight, f1TopZ, wellRightX, landingElevation + railHeight, f1TopZ);

    } else if (layout === 'l_shape') {
        const treadsPerFlight = Math.max(1, Math.floor(numSteps / 2) - 1);
        const treadFt = 10 / 12;
        const treadDepth = treadFt * ppf3D;
        const flightRun = treadsPerFlight * treadDepth;
        const totalW = fw + flightRun;
        const totalL = fw + flightRun;

        const leftX = -totalW / 2;
        const topZ = -totalL / 2;
        const landingElevation = (numSteps / 2) * riserHeight; // 5.5 ft

        // 1. Corner Landing Slab at (leftX + fw/2, topZ + fw/2)
        const landingGeo = new THREE.BoxGeometry(fw, riserHeight * 1.2, fw);
        const landingMesh = new THREE.Mesh(landingGeo, landingMat);
        landingMesh.position.set(leftX + fw / 2, landingElevation - (riserHeight * 0.6), topZ + fw / 2);
        landingMesh.castShadow = true;
        landingMesh.receiveShadow = true;
        landingMesh.userData = { item: asset, floor: floor, type: 'asset_stair' };
        stairGroup.add(landingMesh);

        // 2. Flight 1 Steps: Bottom to Corner Landing
        for (let i = 0; i < treadsPerFlight; i++) {
            const sz = topZ + totalL - (i * treadDepth + treadDepth / 2);
            const sy = i * riserHeight;
            addStep(leftX + fw / 2, sy, sz, fw, treadDepth);
        }

        // 3. Flight 2 Steps: Corner Landing to Right
        for (let i = 0; i < treadsPerFlight; i++) {
            const sx = leftX + fw + (i * treadDepth + treadDepth / 2);
            const sy = landingElevation + (i * riserHeight);
            const stepGroup = new THREE.Group();
            const riserGeo = new THREE.BoxGeometry(0.08 * ppf3D, riserHeight, fw);
            const riserMesh = new THREE.Mesh(riserGeo, riserMat);
            riserMesh.position.set(-treadDepth / 2, riserHeight / 2, 0);
            stepGroup.add(riserMesh);

            const treadGeo = new THREE.BoxGeometry(treadDepth + treadNosing, treadThickness, fw + treadNosing * 0.5);
            const treadMesh = new THREE.Mesh(treadGeo, treadMat);
            treadMesh.position.set(0, riserHeight - treadThickness / 2, 0);
            stepGroup.add(treadMesh);

            stepGroup.position.set(sx, sy, topZ + fw / 2);
            stepGroup.userData = { item: asset, floor: floor, type: 'asset_stair' };
            riserMesh.userData = { item: asset, floor: floor, type: 'asset_stair' };
            treadMesh.userData = { item: asset, floor: floor, type: 'asset_stair' };
            stairGroup.add(stepGroup);
        }

        // Railings
        addRailingPost(leftX + postRadius, 0, topZ + totalL);
        addRailingPost(leftX + postRadius, landingElevation, topZ + postRadius);
        addRailingPost(leftX + totalW, totalHeight, topZ + postRadius);
        addHandrail(leftX + postRadius, railHeight, topZ + totalL, leftX + postRadius, landingElevation + railHeight, topZ + postRadius);
        addHandrail(leftX + postRadius, landingElevation + railHeight, topZ + postRadius, leftX + totalW, totalHeight + railHeight, topZ + postRadius);

    } else { // straight
        const treads = Math.max(1, numSteps - 1);
        const treadFt = 10 / 12;
        const treadDepth = treadFt * ppf3D;
        const totalL = treads * treadDepth;
        const topZ = -totalL / 2;

        for (let i = 0; i < treads; i++) {
            const sz = topZ + totalL - (i * treadDepth + treadDepth / 2);
            const sy = i * (totalHeight / treads);
            addStep(0, sy, sz, fw, treadDepth);
        }

        // Left & Right Safety Handrails
        const leftX = -fw / 2 + postRadius;
        const rightX = fw / 2 - postRadius;
        const bottomZ = topZ + totalL;

        addRailingPost(leftX, 0, bottomZ);
        addRailingPost(leftX, totalHeight, topZ);
        addHandrail(leftX, railHeight, bottomZ, leftX, totalHeight + railHeight, topZ);

        addRailingPost(rightX, 0, bottomZ);
        addRailingPost(rightX, totalHeight, topZ);
        addHandrail(rightX, railHeight, bottomZ, rightX, totalHeight + railHeight, topZ);
    }

    stairGroup.userData = { item: asset, floor: floor, type: 'asset_stair' };
    parentGroup.add(stairGroup);

    // Register staircase zone for multi-floor walkthrough climbing
    const baseY = (parentGroup && parentGroup.position) ? parentGroup.position.y : 0;
    const floorIndex = (state.floors || []).indexOf(floor) >= 0 ? (state.floors || []).indexOf(floor) : Math.round(baseY / totalHeight);
    const treadsPerFlight = Math.max(1, Math.floor(numSteps / 2) - 1);
    const treadDepth = (10 / 12) * ppf3D;
    const flightRun = treadsPerFlight * treadDepth;
    const landingDepth = 3.0 * ppf3D;
    const wellGap = 0.5 * ppf3D;

    staircaseZones.push({
        floorIndex: floorIndex,
        baseY: baseY,
        totalHeight: totalHeight,
        layout: layout,
        cx: cx,
        cz: cz,
        rotDeg: asset.rotation || 0,
        flip: !!asset.flip,
        numSteps: numSteps,
        flightWidth: fw,
        treadDepth: treadDepth,
        treadsPerFlight: treadsPerFlight,
        flightRun: flightRun,
        landingDepth: landingDepth,
        wellGap: wellGap,
        asset: asset,
        floor: floor
    });

    return totalHeight;
}

function create3DStair(x1, z1, x2, z2, startY, ppf3D, isBase = false, parentGroup = houseGroup, asset = null, floor = null) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < 0.1) return startY;

    const angle = Math.atan2(z2 - z1, x2 - x1);
    const stairWidth = 3 * ppf3D;
    const stepRise = (7 / 12) * ppf3D;
    const targetTread = (10 / 12) * ppf3D;
    const numSteps = Math.max(1, Math.round(length / targetTread));
    const actualTread = length / numSteps;

    const stairGroup = new THREE.Group();
    if (asset) stairGroup.userData = { item: asset, floor: floor, type: 'asset_stair' };
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });

    for (let i = 0; i < numSteps; i++) {
        const stepX = x1 + Math.cos(angle) * (i * actualTread + actualTread / 2);
        const stepZ = z1 + Math.sin(angle) * (i * actualTread + actualTread / 2);
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(actualTread, stepRise * 2, stairWidth), stepMat);
        stepMesh.position.set(stepX, startY + (i * stepRise), stepZ);
        stepMesh.rotation.y = -angle;
        stepMesh.castShadow = true;
        stepMesh.receiveShadow = true;
        if (asset) stepMesh.userData = { item: asset, floor: floor, type: 'asset_stair' };
        stairGroup.add(stepMesh);
    }
    parentGroup.add(stairGroup);

    const totalStairHeight = numSteps * stepRise;
    const baseY = (parentGroup && parentGroup.position) ? parentGroup.position.y : startY;
    if (!isBase) {
        staircaseZones.push({
            floorIndex: Math.round(baseY / (11.0 * ppf3D)),
            baseY: baseY,
            totalHeight: totalStairHeight,
            layout: 'line',
            x1: x1, z1: z1,
            x2: x2, z2: z2,
            flightWidth: stairWidth,
            asset: asset,
            floor: floor
        });
    }
    return startY + totalStairHeight;
}

// ============================================================================
// Procedural MEP 3D Engine (Electrical, Plumbing & Sanitary)
// ============================================================================
function create3DMEPAsset(asset, parentGroup, ppf3D, scale, floor, wallHeight, totalRoofY = 0) {
    const cx = asset.x * scale;
    const cz = asset.y * scale;
    const rotRad = -((asset.rotation || 0) * Math.PI) / 180;
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    group.rotation.y = rotRad;

    const attachUserData = (mesh) => {
        mesh.userData = {
            isEditable: true,
            item: asset,
            floor: floor,
            type: asset.type
        };
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    };

    if (asset.type === 'mep_ceiling_fan') {
        // Ceiling mounted: hangs down from ceiling
        const fanGroup = new THREE.Group();
        fanGroup.position.y = wallHeight;

        // 1. Ceiling Canopy
        const canopyGeo = new THREE.CylinderGeometry(0.12 * ppf3D, 0.22 * ppf3D, 0.15 * ppf3D, 16);
        const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
        const canopy = new THREE.Mesh(canopyGeo, darkMetalMat);
        canopy.position.y = -0.075 * ppf3D;
        attachUserData(canopy);
        fanGroup.add(canopy);

        // 2. Downrod
        const rodGeo = new THREE.CylinderGeometry(0.04 * ppf3D, 0.04 * ppf3D, 0.55 * ppf3D, 12);
        const rod = new THREE.Mesh(rodGeo, darkMetalMat);
        rod.position.y = -0.38 * ppf3D;
        attachUserData(rod);
        fanGroup.add(rod);

        // 3. Rotating Fan Hub & 3-Blade Assembly (Animated in 3D)
        const rotorGroup = new THREE.Group();
        rotorGroup.position.y = -0.72 * ppf3D;

        // Central Motor Body
        const motorGeo = new THREE.CylinderGeometry(0.42 * ppf3D, 0.46 * ppf3D, 0.22 * ppf3D, 24);
        const motor = new THREE.Mesh(motorGeo, darkMetalMat);
        attachUserData(motor);
        rotorGroup.add(motor);

        // Center Gold / Brass Trim Accent Ring
        const ringGeo = new THREE.CylinderGeometry(0.47 * ppf3D, 0.47 * ppf3D, 0.04 * ppf3D, 24);
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.85 });
        const ring = new THREE.Mesh(ringGeo, goldMat);
        attachUserData(ring);
        rotorGroup.add(ring);

        // Bottom Under-Dome / Finial
        const domeGeo = new THREE.SphereGeometry(0.16 * ppf3D, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const dome = new THREE.Mesh(domeGeo, goldMat);
        dome.position.y = -0.11 * ppf3D;
        dome.rotation.x = Math.PI;
        attachUserData(dome);
        rotorGroup.add(dome);

        // Three Aerodynamic Fan Blades (120 deg apart)
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.3 });
        const bladeLength = 1.9 * ppf3D;
        const bladeWidth = 0.36 * ppf3D;
        const bladeThick = 0.03 * ppf3D;

        for (let i = 0; i < 3; i++) {
            const angle = (i * 2 * Math.PI) / 3;
            const bladeArm = new THREE.Group();
            bladeArm.rotation.y = angle;

            const bGeo = new THREE.BoxGeometry(bladeWidth, bladeThick, bladeLength);
            const blade = new THREE.Mesh(bGeo, bladeMat);
            blade.position.set(0, 0.01 * ppf3D, bladeLength / 2 + 0.35 * ppf3D);
            blade.rotation.x = 0.12; // Aerodynamic pitch angle
            attachUserData(blade);
            bladeArm.add(blade);
            rotorGroup.add(bladeArm);
        }

        fanGroup.add(rotorGroup);
        animatedFanRotors.push(rotorGroup);

        group.add(fanGroup);

    } else if (asset.type === 'mep_wall_ac') {
        // High Wall Mounted Split AC Unit
        const acGroup = new THREE.Group();
        acGroup.position.y = wallHeight - 1.8 * ppf3D;

        const acW = 3.2 * ppf3D;
        const acH = 1.05 * ppf3D;
        const acD = 0.8 * ppf3D;

        // AC Main Body (Glossy White)
        const acMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.05 });
        const acBodyGeo = new THREE.BoxGeometry(acW, acH, acD);
        const acBody = new THREE.Mesh(acBodyGeo, acMat);
        attachUserData(acBody);
        acGroup.add(acBody);

        // Horizontal bottom air louvre deflector
        const louvreMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
        const louvreGeo = new THREE.BoxGeometry(acW * 0.92, 0.12 * ppf3D, 0.04 * ppf3D);
        const louvre = new THREE.Mesh(louvreGeo, louvreMat);
        louvre.position.set(0, -acH * 0.38, acD * 0.51);
        attachUserData(louvre);
        acGroup.add(louvre);

        // Top Air Intake Slats Accent Strip
        const topVentGeo = new THREE.BoxGeometry(acW * 0.88, 0.04 * ppf3D, acD * 0.6);
        const topVentMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
        const topVent = new THREE.Mesh(topVentGeo, topVentMat);
        topVent.position.set(0, acH * 0.51, 0);
        attachUserData(topVent);
        acGroup.add(topVent);

        // Hidden LED Display (Glowing Cyan temperature dot)
        const ledGeo = new THREE.BoxGeometry(0.2 * ppf3D, 0.1 * ppf3D, 0.02 * ppf3D);
        const ledMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.8,
            roughness: 0.1
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(acW * 0.35, 0, acD * 0.51);
        attachUserData(led);
        acGroup.add(led);

        group.add(acGroup);

    } else if (asset.type === 'mep_switchboard') {
        // Wall Mounted Switchboard at 4 ft
        const sbGroup = new THREE.Group();
        sbGroup.position.y = 4.0 * ppf3D;

        const sbW = 0.85 * ppf3D;
        const sbH = 0.65 * ppf3D;
        const sbD = 0.08 * ppf3D;

        // Outer Modular Plate
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.1 });
        const plateGeo = new THREE.BoxGeometry(sbW, sbH, sbD);
        const plate = new THREE.Mesh(plateGeo, plateMat);
        attachUserData(plate);
        sbGroup.add(plate);

        // Inner Bezel Grid
        const innerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
        const innerGeo = new THREE.BoxGeometry(sbW * 0.85, sbH * 0.75, 0.02 * ppf3D);
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.position.z = sbD * 0.51;
        attachUserData(inner);
        sbGroup.add(inner);

        // 4 Switch Buttons
        const swMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        for (let i = 0; i < 4; i++) {
            const swGeo = new THREE.BoxGeometry(0.12 * ppf3D, 0.2 * ppf3D, 0.03 * ppf3D);
            const sw = new THREE.Mesh(swGeo, swMat);
            const sx = (-0.28 + i * 0.18) * ppf3D;
            sw.position.set(sx, 0.05 * ppf3D, sbD * 0.6);
            attachUserData(sw);
            sbGroup.add(sw);
        }

        // Red Power Indicator LED
        const redLedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xef4444, emissiveIntensity: 0.9 });
        const redLedGeo = new THREE.BoxGeometry(0.04 * ppf3D, 0.04 * ppf3D, 0.03 * ppf3D);
        const redLed = new THREE.Mesh(redLedGeo, redLedMat);
        redLed.position.set(0.3 * ppf3D, 0.2 * ppf3D, sbD * 0.6);
        attachUserData(redLed);
        sbGroup.add(redLed);

        group.add(sbGroup);

    } else if (asset.type === 'mep_light_ceiling') {
        // Ceiling Downlight / Chandelier Fixture
        const lightGroup = new THREE.Group();
        lightGroup.position.y = wallHeight - 0.12 * ppf3D;

        // Outer Brushed Brass Trim Bezel
        const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 });
        const trimGeo = new THREE.CylinderGeometry(0.6 * ppf3D, 0.72 * ppf3D, 0.12 * ppf3D, 24);
        const trim = new THREE.Mesh(trimGeo, trimMat);
        attachUserData(trim);
        lightGroup.add(trim);

        // Frosted Diffuser Lens
        const lensMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xfffbeb,
            emissiveIntensity: 0.6,
            roughness: 0.1
        });
        const lensGeo = new THREE.CylinderGeometry(0.52 * ppf3D, 0.52 * ppf3D, 0.06 * ppf3D, 24);
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.y = -0.04 * ppf3D;
        attachUserData(lens);
        lightGroup.add(lens);

        // Warm Interior Accent Light
        const pLight = new THREE.PointLight(0xffedd5, 0.5, 40 * ppf3D, 1.8);
        pLight.position.y = -0.4 * ppf3D;
        lightGroup.add(pLight);

        group.add(lightGroup);

    } else if (asset.type === 'mep_mcb_box') {
        // Wall Mounted Distribution Board (MCB Box) at 5 ft
        const mcbGroup = new THREE.Group();
        mcbGroup.position.y = 5.0 * ppf3D;

        const bW = 1.25 * ppf3D;
        const bH = 1.6 * ppf3D;
        const bD = 0.28 * ppf3D;

        // Metal Enclosure Box
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.5 });
        const boxGeo = new THREE.BoxGeometry(bW, bH, bD);
        const enclosure = new THREE.Mesh(boxGeo, boxMat);
        attachUserData(enclosure);
        mcbGroup.add(enclosure);

        // Smoked Acrylic Door View Window
        const winMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.1,
            metalness: 0.2,
            transparent: true,
            opacity: 0.85
        });
        const winGeo = new THREE.BoxGeometry(bW * 0.8, bH * 0.6, 0.02 * ppf3D);
        const windowPane = new THREE.Mesh(winGeo, winMat);
        windowPane.position.set(0, 0.15 * ppf3D, bD * 0.51);
        attachUserData(windowPane);
        mcbGroup.add(windowPane);

        // MCB Switches Row (Red & Black Breakers)
        for (let i = 0; i < 6; i++) {
            const isMain = (i < 2);
            const swMat = new THREE.MeshStandardMaterial({
                color: isMain ? 0xdc2626 : 0x1e293b,
                roughness: 0.3
            });
            const mcbSwGeo = new THREE.BoxGeometry(0.1 * ppf3D, 0.22 * ppf3D, 0.08 * ppf3D);
            const mcbSw = new THREE.Mesh(mcbSwGeo, swMat);
            const sx = (-0.35 + i * 0.14) * ppf3D;
            mcbSw.position.set(sx, 0.15 * ppf3D, bD * 0.52);
            attachUserData(mcbSw);
            mcbGroup.add(mcbSw);
        }

        // Danger Warning Emblem Yellow Badge
        const badgeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
        const badgeGeo = new THREE.BoxGeometry(0.25 * ppf3D, 0.15 * ppf3D, 0.02 * ppf3D);
        const badge = new THREE.Mesh(badgeGeo, badgeMat);
        badge.position.set(0, -bH * 0.32, bD * 0.51);
        attachUserData(badge);
        mcbGroup.add(badge);

        group.add(mcbGroup);

    } else if (asset.type === 'mep_wc') {
        // Floor Mounted Vitreous China Western Toilet (WC)
        const wcGroup = new THREE.Group();

        const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.05 });
        const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.95 });

        // Base Pedestal
        const baseGeo = new THREE.BoxGeometry(1.05 * ppf3D, 0.5 * ppf3D, 1.4 * ppf3D);
        const baseMesh = new THREE.Mesh(baseGeo, ceramicMat);
        baseMesh.position.set(0, 0.25 * ppf3D, 0.1 * ppf3D);
        attachUserData(baseMesh);
        wcGroup.add(baseMesh);

        // Oval Sculpted Bowl
        const bowlGeo = new THREE.CylinderGeometry(0.58 * ppf3D, 0.48 * ppf3D, 0.85 * ppf3D, 24);
        const bowl = new THREE.Mesh(bowlGeo, ceramicMat);
        bowl.position.set(0, 0.85 * ppf3D, 0.25 * ppf3D);
        attachUserData(bowl);
        wcGroup.add(bowl);

        // Seat & Cover Lid
        const seatGeo = new THREE.CylinderGeometry(0.6 * ppf3D, 0.6 * ppf3D, 0.08 * ppf3D, 24);
        const seat = new THREE.Mesh(seatGeo, darkTrimMat);
        seat.position.set(0, 1.3 * ppf3D, 0.25 * ppf3D);
        attachUserData(seat);
        wcGroup.add(seat);

        // Cistern Water Tank
        const tankGeo = new THREE.BoxGeometry(1.3 * ppf3D, 1.5 * ppf3D, 0.55 * ppf3D);
        const tank = new THREE.Mesh(tankGeo, ceramicMat);
        tank.position.set(0, 1.45 * ppf3D, -0.45 * ppf3D);
        attachUserData(tank);
        wcGroup.add(tank);

        // Cistern Lid
        const lidGeo = new THREE.BoxGeometry(1.36 * ppf3D, 0.1 * ppf3D, 0.6 * ppf3D);
        const lid = new THREE.Mesh(lidGeo, ceramicMat);
        lid.position.set(0, 2.22 * ppf3D, -0.45 * ppf3D);
        attachUserData(lid);
        wcGroup.add(lid);

        // Chrome Dual Flush Button on Top
        const flushGeo = new THREE.CylinderGeometry(0.12 * ppf3D, 0.12 * ppf3D, 0.04 * ppf3D, 16);
        const flushBtn = new THREE.Mesh(flushGeo, chromeMat);
        flushBtn.position.set(0, 2.28 * ppf3D, -0.45 * ppf3D);
        attachUserData(flushBtn);
        wcGroup.add(flushBtn);

        group.add(wcGroup);

    } else if (asset.type === 'mep_wash_basin') {
        // Wall Mounted Wash Basin with Chrome Gooseneck Tap
        const basinGroup = new THREE.Group();
        basinGroup.position.y = 2.7 * ppf3D;

        const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.05 });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.95 });

        // Basin Body Outer
        const basinGeo = new THREE.BoxGeometry(1.8 * ppf3D, 0.65 * ppf3D, 1.4 * ppf3D);
        const basin = new THREE.Mesh(basinGeo, ceramicMat);
        attachUserData(basin);
        basinGroup.add(basin);

        // Backsplash Rim
        const splashGeo = new THREE.BoxGeometry(1.8 * ppf3D, 0.35 * ppf3D, 0.1 * ppf3D);
        const splash = new THREE.Mesh(splashGeo, ceramicMat);
        splash.position.set(0, 0.35 * ppf3D, -0.65 * ppf3D);
        attachUserData(splash);
        basinGroup.add(splash);

        // Faucet Base & Gooseneck Tap
        const tapRiserGeo = new THREE.CylinderGeometry(0.04 * ppf3D, 0.04 * ppf3D, 0.6 * ppf3D, 12);
        const tapRiser = new THREE.Mesh(tapRiserGeo, chromeMat);
        tapRiser.position.set(0, 0.5 * ppf3D, -0.45 * ppf3D);
        attachUserData(tapRiser);
        basinGroup.add(tapRiser);

        const tapSpoutGeo = new THREE.CylinderGeometry(0.035 * ppf3D, 0.035 * ppf3D, 0.4 * ppf3D, 12);
        const tapSpout = new THREE.Mesh(tapSpoutGeo, chromeMat);
        tapSpout.rotation.x = Math.PI / 3;
        tapSpout.position.set(0, 0.8 * ppf3D, -0.32 * ppf3D);
        attachUserData(tapSpout);
        basinGroup.add(tapSpout);

        // Chrome Drain Plug in Basin
        const drainGeo = new THREE.CylinderGeometry(0.12 * ppf3D, 0.12 * ppf3D, 0.02 * ppf3D, 16);
        const drain = new THREE.Mesh(drainGeo, chromeMat);
        drain.position.set(0, 0.33 * ppf3D, 0);
        attachUserData(drain);
        basinGroup.add(drain);

        // Under-Basin Semi-Pedestal / P-Trap Pipe
        const pipeGeo = new THREE.CylinderGeometry(0.18 * ppf3D, 0.14 * ppf3D, 1.6 * ppf3D, 16);
        const pipeMesh = new THREE.Mesh(pipeGeo, ceramicMat);
        pipeMesh.position.set(0, -1.0 * ppf3D, -0.15 * ppf3D);
        attachUserData(pipeMesh);
        basinGroup.add(pipeMesh);

        group.add(basinGroup);

    } else if (asset.type === 'mep_shower') {
        // High Wall Mounted Rain Shower & Diverter
        const showerGroup = new THREE.Group();

        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.95 });

        // Wall Flange Mount at 7.2 ft
        const flangeGeo = new THREE.CylinderGeometry(0.18 * ppf3D, 0.18 * ppf3D, 0.04 * ppf3D, 16);
        const flange = new THREE.Mesh(flangeGeo, chromeMat);
        flange.rotation.x = Math.PI / 2;
        flange.position.set(0, 7.2 * ppf3D, -0.6 * ppf3D);
        attachUserData(flange);
        showerGroup.add(flange);

        // Horizontal Shower Arm Pipe
        const armGeo = new THREE.CylinderGeometry(0.04 * ppf3D, 0.04 * ppf3D, 1.3 * ppf3D, 12);
        const arm = new THREE.Mesh(armGeo, chromeMat);
        arm.rotation.x = Math.PI / 2;
        arm.position.set(0, 7.2 * ppf3D, 0.05 * ppf3D);
        attachUserData(arm);
        showerGroup.add(arm);

        // Rain Shower Head Disc
        const headGeo = new THREE.CylinderGeometry(0.55 * ppf3D, 0.55 * ppf3D, 0.08 * ppf3D, 24);
        const head = new THREE.Mesh(headGeo, chromeMat);
        head.position.set(0, 6.95 * ppf3D, 0.65 * ppf3D);
        attachUserData(head);
        showerGroup.add(head);

        // Wall Diverter Mixer Lever at 3.6 ft
        const divPlateGeo = new THREE.CylinderGeometry(0.3 * ppf3D, 0.3 * ppf3D, 0.04 * ppf3D, 16);
        const divPlate = new THREE.Mesh(divPlateGeo, chromeMat);
        divPlate.rotation.x = Math.PI / 2;
        divPlate.position.set(0, 3.6 * ppf3D, -0.6 * ppf3D);
        attachUserData(divPlate);
        showerGroup.add(divPlate);

        const leverGeo = new THREE.BoxGeometry(0.06 * ppf3D, 0.3 * ppf3D, 0.15 * ppf3D);
        const lever = new THREE.Mesh(leverGeo, chromeMat);
        lever.position.set(0, 3.6 * ppf3D, -0.48 * ppf3D);
        attachUserData(lever);
        showerGroup.add(lever);

        group.add(showerGroup);

    } else if (asset.type === 'mep_drain_trap') {
        // Floor Drain Trap (Square Stainless Steel Grating)
        const drainGroup = new THREE.Group();
        drainGroup.position.y = 0.03 * ppf3D;

        const ssMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.85 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

        // Outer Frame
        const frameGeo = new THREE.BoxGeometry(0.7 * ppf3D, 0.04 * ppf3D, 0.7 * ppf3D);
        const frame = new THREE.Mesh(frameGeo, ssMat);
        attachUserData(frame);
        drainGroup.add(frame);

        // Dark Drain Recess Hole
        const recessGeo = new THREE.CylinderGeometry(0.26 * ppf3D, 0.26 * ppf3D, 0.05 * ppf3D, 16);
        const recess = new THREE.Mesh(recessGeo, darkMat);
        recess.position.y = 0.01 * ppf3D;
        attachUserData(recess);
        drainGroup.add(recess);

        // Perforated Grating Center Ring
        const ringGeo = new THREE.CylinderGeometry(0.24 * ppf3D, 0.24 * ppf3D, 0.06 * ppf3D, 16);
        const ring = new THREE.Mesh(ringGeo, ssMat);
        ring.position.y = 0.02 * ppf3D;
        attachUserData(ring);
        drainGroup.add(ring);

        group.add(drainGroup);

    } else if (asset.type === 'mep_kitchen_sink') {
        // Kitchen Sink (Stainless Steel Satin Finish) at Counter Height (2.8 ft)
        const sinkGroup = new THREE.Group();
        sinkGroup.position.y = 2.8 * ppf3D;

        const ssMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.95 });

        // Top Rim / Flange
        const rimGeo = new THREE.BoxGeometry(2.3 * ppf3D, 0.06 * ppf3D, 1.7 * ppf3D);
        const rim = new THREE.Mesh(rimGeo, ssMat);
        attachUserData(rim);
        sinkGroup.add(rim);

        // Deep Sink Basin Well
        const basinGeo = new THREE.BoxGeometry(1.9 * ppf3D, 0.85 * ppf3D, 1.35 * ppf3D);
        const basin = new THREE.Mesh(basinGeo, ssMat);
        basin.position.y = -0.42 * ppf3D;
        attachUserData(basin);
        sinkGroup.add(basin);

        // High-Arc Swivel Gooseneck Faucet
        const tapRiserGeo = new THREE.CylinderGeometry(0.04 * ppf3D, 0.04 * ppf3D, 0.7 * ppf3D, 12);
        const tapRiser = new THREE.Mesh(tapRiserGeo, chromeMat);
        tapRiser.position.set(0, 0.4 * ppf3D, -0.65 * ppf3D);
        attachUserData(tapRiser);
        sinkGroup.add(tapRiser);

        const tapArchGeo = new THREE.TorusGeometry(0.25 * ppf3D, 0.035 * ppf3D, 8, 16, Math.PI);
        const tapArch = new THREE.Mesh(tapArchGeo, chromeMat);
        tapArch.rotation.y = Math.PI / 2;
        tapArch.position.set(0, 0.75 * ppf3D, -0.4 * ppf3D);
        attachUserData(tapArch);
        sinkGroup.add(tapArch);

        // Drain Strainer
        const strainerGeo = new THREE.CylinderGeometry(0.14 * ppf3D, 0.14 * ppf3D, 0.02 * ppf3D, 16);
        const strainer = new THREE.Mesh(strainerGeo, chromeMat);
        strainer.position.set(0, -0.84 * ppf3D, 0);
        attachUserData(strainer);
        sinkGroup.add(strainer);

        group.add(sinkGroup);

    } else if (asset.type === 'mep_overhead_tank') {
        // Heavy Duty Cylindrical Polyethylene Overhead Water Tank on Top Roof
        const tankGroup = new THREE.Group();
        tankGroup.position.y = totalRoofY;

        const tankMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.1 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });

        // 1. Dunnage Support Base (4 Steel Legs & Frame)
        const frameW = 2.8 * ppf3D;
        const frameH = 0.7 * ppf3D;
        const beamGeo = new THREE.BoxGeometry(frameW, 0.15 * ppf3D, frameW);
        const beam = new THREE.Mesh(beamGeo, steelMat);
        beam.position.y = frameH;
        attachUserData(beam);
        tankGroup.add(beam);

        // 4 Legs
        const legPositions = [
            [-frameW * 0.42, -frameW * 0.42],
            [frameW * 0.42, -frameW * 0.42],
            [-frameW * 0.42, frameW * 0.42],
            [frameW * 0.42, frameW * 0.42]
        ];
        legPositions.forEach(([lx, lz]) => {
            const legGeo = new THREE.BoxGeometry(0.18 * ppf3D, frameH, 0.18 * ppf3D);
            const leg = new THREE.Mesh(legGeo, steelMat);
            leg.position.set(lx, frameH / 2, lz);
            attachUserData(leg);
            tankGroup.add(leg);
        });

        // 2. Main Cylindrical Tank Body
        const tankR = 1.45 * ppf3D;
        const tankH = 3.2 * ppf3D;
        const tankGeo = new THREE.CylinderGeometry(tankR, tankR, tankH, 24);
        const tankMesh = new THREE.Mesh(tankGeo, tankMat);
        tankMesh.position.y = frameH + 0.08 * ppf3D + (tankH / 2);
        attachUserData(tankMesh);
        tankGroup.add(tankMesh);

        // 3. Structural Circumferential Hoop Ribs (3 Rings)
        for (let r = 0; r < 3; r++) {
            const ribGeo = new THREE.TorusGeometry(tankR + 0.02 * ppf3D, 0.04 * ppf3D, 8, 24);
            const rib = new THREE.Mesh(ribGeo, tankMat);
            rib.rotation.x = Math.PI / 2;
            rib.position.y = frameH + 0.08 * ppf3D + (0.8 + r * 0.8) * ppf3D;
            attachUserData(rib);
            tankGroup.add(rib);
        }

        // 4. Conical Top Roof Cover
        const coneGeo = new THREE.ConeGeometry(tankR + 0.05 * ppf3D, 0.5 * ppf3D, 24);
        const cone = new THREE.Mesh(coneGeo, tankMat);
        cone.position.y = frameH + 0.08 * ppf3D + tankH + 0.25 * ppf3D;
        attachUserData(cone);
        tankGroup.add(cone);

        // 5. Central Threaded Inspection Manhole Cap
        const capGeo = new THREE.CylinderGeometry(0.45 * ppf3D, 0.45 * ppf3D, 0.16 * ppf3D, 16);
        const cap = new THREE.Mesh(capGeo, lidMat);
        cap.position.y = frameH + 0.08 * ppf3D + tankH + 0.55 * ppf3D;
        attachUserData(cap);
        tankGroup.add(cap);

        // 6. Overflow / Supply PVC Pipe
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 });
        const pRiserGeo = new THREE.CylinderGeometry(0.06 * ppf3D, 0.06 * ppf3D, frameH + tankH * 0.5, 12);
        const pRiser = new THREE.Mesh(pRiserGeo, pipeMat);
        pRiser.position.set(tankR * 0.85, (frameH + tankH * 0.5) / 2, tankR * 0.4);
        attachUserData(pRiser);
        tankGroup.add(pRiser);

        group.add(tankGroup);

    } else if (asset.type === 'mep_septic_tank') {
        // Underground Heavy RCC Septic & Water Tank
        const septicGroup = new THREE.Group();

        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, metalness: 0.05 });
        const ironCoverMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.85 });
        const pvcMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 });

        const tankW = 4.8 * ppf3D;
        const tankL = 6.2 * ppf3D;
        const tankD = 3.6 * ppf3D;

        // 1. Underground RCC Concrete Vault (Beneath Ground Level y = 0)
        const vaultGeo = new THREE.BoxGeometry(tankW, tankD, tankL);
        const vault = new THREE.Mesh(vaultGeo, concreteMat);
        vault.position.y = -tankD / 2;
        attachUserData(vault);
        septicGroup.add(vault);

        // 2. Concrete Top Slab Lip at Ground Level
        const lipGeo = new THREE.BoxGeometry(tankW + 0.4 * ppf3D, 0.08 * ppf3D, tankL + 0.4 * ppf3D);
        const lip = new THREE.Mesh(lipGeo, concreteMat);
        lip.position.y = 0.02 * ppf3D;
        attachUserData(lip);
        septicGroup.add(lip);

        // 3. Two Circular Cast-Iron Manhole Inspection Covers flush at ground
        const manholeGeo = new THREE.CylinderGeometry(0.62 * ppf3D, 0.62 * ppf3D, 0.06 * ppf3D, 24);
        const mh1 = new THREE.Mesh(manholeGeo, ironCoverMat);
        mh1.position.set(0, 0.05 * ppf3D, -tankL * 0.28);
        attachUserData(mh1);
        septicGroup.add(mh1);

        const mh2 = new THREE.Mesh(manholeGeo, ironCoverMat);
        mh2.position.set(0, 0.05 * ppf3D, tankL * 0.28);
        attachUserData(mh2);
        septicGroup.add(mh2);

        // 4. Rising Ventilation Cowl Pipe
        const ventPipeGeo = new THREE.CylinderGeometry(0.08 * ppf3D, 0.08 * ppf3D, 3.2 * ppf3D, 12);
        const ventPipe = new THREE.Mesh(ventPipeGeo, pvcMat);
        ventPipe.position.set(tankW * 0.38, 1.6 * ppf3D, -tankL * 0.38);
        attachUserData(ventPipe);
        septicGroup.add(ventPipe);

        // Vent Mushroom / Cowl Hood at Top
        const cowlGeo = new THREE.SphereGeometry(0.22 * ppf3D, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const cowl = new THREE.Mesh(cowlGeo, ironCoverMat);
        cowl.position.set(tankW * 0.38, 3.25 * ppf3D, -tankL * 0.38);
        attachUserData(cowl);
        septicGroup.add(cowl);

        group.add(septicGroup);
    }

    parentGroup.add(group);
}

// ============================================================================
// Exterior Compound Wall, Main Gate & Car Ramp 3D Generator
// ============================================================================
function create3DCompoundSystem(cp, p, ppf3D, scale, parentGroup) {
    const compoundGroup = new THREE.Group();
    const cSettings = state.compound || {};
    const cWallH = (cSettings.heightFt || 5.0) * ppf3D;
    const cWallThick = 0.65 * ppf3D;
    const plinthH = 0.25 * ppf3D; // Yard plinth level above street
    const doorSide = state.door || 'front';
    const gateStyle = cSettings.gateStyle || 'sliding';
    const hasRamp = cSettings.addRamp !== false;
    const gateW = Math.max(7 * ppf3D, Math.min(12 * ppf3D, (cSettings.gateWidthFt || 9.0) * ppf3D));

    // 1. Yard Ground Plinth Base
    const yardShape = new THREE.Shape();
    yardShape.moveTo(cp[0].x, cp[0].z);
    yardShape.lineTo(cp[1].x, cp[1].z);
    yardShape.lineTo(cp[2].x, cp[2].z);
    yardShape.lineTo(cp[3].x, cp[3].z);
    yardShape.closePath();

    const yardGeo = new THREE.ExtrudeGeometry(yardShape, { depth: plinthH, bevelEnabled: false });
    const yardMat = new THREE.MeshStandardMaterial({
        color: 0xd6d3d1, // Clean outdoor paving / warm sandstone
        roughness: 0.8,
        metalness: 0.05
    });
    const yardMesh = new THREE.Mesh(yardGeo, yardMat);
    yardMesh.rotation.x = Math.PI / 2;
    yardMesh.position.y = plinthH;
    yardMesh.receiveShadow = true;
    yardMesh.userData = { isCompoundWall: true };
    compoundGroup.add(yardMesh);

    // 2. Materials
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85, metalness: 0.05 });
    const wallBaseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7, metalness: 0.1 });
    const copingMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.1 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.15 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.85 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.9 });

    // Helper: Add straight wall segment with base strip and coping cap
    function addWallSegment(x1, z1, x2, z2) {
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len < 0.2) return;
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        const angle = Math.atan2(dz, dx);

        // Wall Body
        const bodyGeo = new THREE.BoxGeometry(len, cWallH, cWallThick);
        const bodyMesh = new THREE.Mesh(bodyGeo, wallMat);
        bodyMesh.position.set(cx, cWallH / 2, cz);
        bodyMesh.rotation.y = -angle;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        bodyMesh.userData = { isCompoundWall: true };
        compoundGroup.add(bodyMesh);

        // Bottom Stone Plinth Strip
        const baseGeo = new THREE.BoxGeometry(len, 0.8 * ppf3D, cWallThick + 0.06 * ppf3D);
        const baseMesh = new THREE.Mesh(baseGeo, wallBaseMat);
        baseMesh.position.set(cx, (0.8 * ppf3D) / 2, cz);
        baseMesh.rotation.y = -angle;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        baseMesh.userData = { isCompoundWall: true };
        compoundGroup.add(baseMesh);

        // Top Coping Cap Stone
        const capGeo = new THREE.BoxGeometry(len + 0.05 * ppf3D, 0.18 * ppf3D, cWallThick + 0.15 * ppf3D);
        const capMesh = new THREE.Mesh(capGeo, copingMat);
        capMesh.position.set(cx, cWallH + (0.18 * ppf3D) / 2, cz);
        capMesh.rotation.y = -angle;
        capMesh.castShadow = true;
        capMesh.receiveShadow = true;
        capMesh.userData = { isCompoundWall: true };
        compoundGroup.add(capMesh);

        // Register in collidableWalls
        const pad = cWallThick / 2;
        const box = new THREE.Box3(
            new THREE.Vector3(Math.min(x1, x2) - pad, 0, Math.min(z1, z2) - pad),
            new THREE.Vector3(Math.max(x1, x2) + pad, cWallH, Math.max(z1, z2) + pad)
        );
        collidableWalls.push({
            box: box,
            x1: x1, z1: z1,
            x2: x2, z2: z2,
            baseY: 0,
            topY: cWallH,
            thickness: cWallThick,
            isDoor: false,
            type: 'compound_wall'
        });
    }

    // Helper: Add Decorative Corner Pillar Column
    function addCornerPillar(px, pz) {
        const pillarW = 1.35 * ppf3D;
        const pillarH = cWallH + 0.5 * ppf3D;

        const shaftGeo = new THREE.BoxGeometry(pillarW, pillarH, pillarW);
        const shaft = new THREE.Mesh(shaftGeo, pillarMat);
        shaft.position.set(px, pillarH / 2, pz);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        shaft.userData = { isCompoundWall: true };
        compoundGroup.add(shaft);

        const cap1Geo = new THREE.BoxGeometry(pillarW + 0.25 * ppf3D, 0.16 * ppf3D, pillarW + 0.25 * ppf3D);
        const cap1 = new THREE.Mesh(cap1Geo, copingMat);
        cap1.position.set(px, pillarH + (0.16 * ppf3D) / 2, pz);
        cap1.castShadow = true;
        cap1.userData = { isCompoundWall: true };
        compoundGroup.add(cap1);

        const cap2Geo = new THREE.BoxGeometry(pillarW + 0.1 * ppf3D, 0.15 * ppf3D, pillarW + 0.1 * ppf3D);
        const cap2 = new THREE.Mesh(cap2Geo, copingMat);
        cap2.position.set(px, pillarH + 0.16 * ppf3D + (0.15 * ppf3D) / 2, pz);
        cap2.castShadow = true;
        cap2.userData = { isCompoundWall: true };
        compoundGroup.add(cap2);
    }

    // Helper: Add Gate Post with Lantern (Glowing at Night)
    function addGatePost(px, pz) {
        const postW = 1.6 * ppf3D;
        const postH = cWallH + 0.85 * ppf3D;

        const shaftGeo = new THREE.BoxGeometry(postW, postH, postW);
        const shaft = new THREE.Mesh(shaftGeo, pillarMat);
        shaft.position.set(px, postH / 2, pz);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        shaft.userData = { isCompoundWall: true };
        compoundGroup.add(shaft);

        const baseMould = new THREE.Mesh(new THREE.BoxGeometry(postW + 0.2 * ppf3D, 0.8 * ppf3D, postW + 0.2 * ppf3D), wallBaseMat);
        baseMould.position.set(px, 0.4 * ppf3D, pz);
        baseMould.castShadow = true;
        baseMould.userData = { isCompoundWall: true };
        compoundGroup.add(baseMould);

        const capGeo = new THREE.BoxGeometry(postW + 0.3 * ppf3D, 0.22 * ppf3D, postW + 0.3 * ppf3D);
        const cap = new THREE.Mesh(capGeo, copingMat);
        cap.position.set(px, postH + (0.22 * ppf3D) / 2, pz);
        cap.castShadow = true;
        cap.userData = { isCompoundWall: true };
        compoundGroup.add(cap);

        // Gate-Post Lantern Fixture
        const lanternBaseGeo = new THREE.CylinderGeometry(0.22 * ppf3D, 0.28 * ppf3D, 0.15 * ppf3D, 12);
        const lanternBase = new THREE.Mesh(lanternBaseGeo, metalMat);
        lanternBase.position.set(px, postH + 0.22 * ppf3D + (0.15 * ppf3D) / 2, pz);
        lanternBase.userData = { isCompoundWall: true };
        compoundGroup.add(lanternBase);

        const lanternGlassGeo = new THREE.BoxGeometry(0.55 * ppf3D, 0.7 * ppf3D, 0.55 * ppf3D);
        const lanternGlassMat = new THREE.MeshStandardMaterial({
            color: 0xfffbeb,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.75
        });
        const lanternGlass = new THREE.Mesh(lanternGlassGeo, lanternGlassMat);
        lanternGlass.position.set(px, postH + 0.37 * ppf3D + (0.7 * ppf3D) / 2, pz);
        lanternGlass.userData = { isCompoundWall: true };
        compoundGroup.add(lanternGlass);

        const hoodGeo = new THREE.ConeGeometry(0.48 * ppf3D, 0.35 * ppf3D, 4);
        const hood = new THREE.Mesh(hoodGeo, metalMat);
        hood.rotation.y = Math.PI / 4;
        hood.position.set(px, postH + 0.37 * ppf3D + 0.7 * ppf3D + (0.35 * ppf3D) / 2, pz);
        hood.userData = { isCompoundWall: true };
        compoundGroup.add(hood);

        const bulbMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xfbbf24,
            emissiveIntensity: 0.08,
            roughness: 0.2
        });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18 * ppf3D, 12, 8), bulbMat);
        bulb.position.set(px, postH + 0.37 * ppf3D + (0.7 * ppf3D) / 2, pz);
        bulb.userData = { isCompoundWall: true };
        compoundGroup.add(bulb);

        // Night Lamp PointLight
        const lampLight = new THREE.PointLight(0xfbbf24, 0, 35 * ppf3D, 1.5);
        lampLight.position.set(px, postH + 0.37 * ppf3D + (0.7 * ppf3D) / 2, pz);
        compoundGroup.add(lampLight);

        interiorLights.push({ light: lampLight, fixture: bulb });
    }

    const sides = [
        { name: 'front', p1: cp[0], p2: cp[1], nx: 0, nz: 1 },
        { name: 'right', p1: cp[1], p2: cp[2], nx: 1, nz: 0 },
        { name: 'back',  p1: cp[2], p2: cp[3], nx: 0, nz: -1 },
        { name: 'left',  p1: cp[3], p2: cp[0], nx: -1, nz: 0 }
    ];

    let gateInfo = null;

    sides.forEach(side => {
        const isDoorSide = (side.name === doorSide);
        const dx = side.p2.x - side.p1.x;
        const dz = side.p2.z - side.p1.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.5) return;
        const tx = dx / len;
        const tz = dz / len;

        if (!isDoorSide) {
            addWallSegment(side.p1.x, side.p1.z, side.p2.x, side.p2.z);
        } else {
            const actualGateW = Math.min(gateW, Math.max(5 * ppf3D, len - 3.5 * ppf3D));
            const midX = (side.p1.x + side.p2.x) / 2;
            const midZ = (side.p1.z + side.p2.z) / 2;

            const gp1x = midX - (actualGateW / 2) * tx;
            const gp1z = midZ - (actualGateW / 2) * tz;
            const gp2x = midX + (actualGateW / 2) * tx;
            const gp2z = midZ + (actualGateW / 2) * tz;

            // Wall Segment 1 (corner 1 to post 1)
            addWallSegment(side.p1.x, side.p1.z, gp1x - tx * (0.8 * ppf3D), gp1z - tz * (0.8 * ppf3D));

            // Wall Segment 2 (post 2 to corner 2)
            addWallSegment(gp2x + tx * (0.8 * ppf3D), gp2z + tz * (0.8 * ppf3D), side.p2.x, side.p2.z);

            addGatePost(gp1x, gp1z);
            addGatePost(gp2x, gp2z);

            gateInfo = {
                centerX: midX,
                centerZ: midZ,
                width: actualGateW,
                tx: tx,
                tz: tz,
                nx: side.nx,
                nz: side.nz,
                gp1: { x: gp1x, z: gp1z },
                gp2: { x: gp2x, z: gp2z }
            };
        }
    });

    addCornerPillar(cp[0].x, cp[0].z);
    addCornerPillar(cp[1].x, cp[1].z);
    addCornerPillar(cp[2].x, cp[2].z);
    addCornerPillar(cp[3].x, cp[3].z);

    // 3. Gate Mesh & Car Parking Ramp
    if (gateInfo) {
        const { centerX, centerZ, width: gW, tx, tz, nx, nz } = gateInfo;
        const gateAngle = Math.atan2(tz, tx);
        const gateH = cWallH * 0.92;

        if (gateStyle !== 'open') {
            const gateMeshGroup = new THREE.Group();
            gateMeshGroup.position.set(centerX, 0, centerZ);
            gateMeshGroup.rotation.y = -gateAngle;

            if (gateStyle === 'sliding') {
                // Sliding Modern Iron Gate
                const topBeamGeo = new THREE.BoxGeometry(gW * 1.05, 0.16 * ppf3D, 0.12 * ppf3D);
                const topBeam = new THREE.Mesh(topBeamGeo, metalMat);
                topBeam.position.set(0, gateH + 0.1 * ppf3D, 0);
                topBeam.castShadow = true;
                gateMeshGroup.add(topBeam);

                const botRail = new THREE.Mesh(new THREE.BoxGeometry(gW * 1.05, 0.12 * ppf3D, 0.1 * ppf3D), metalMat);
                botRail.position.set(0, 0.1 * ppf3D, 0);
                gateMeshGroup.add(botRail);

                const gatePanelGroup = new THREE.Group();
                const frameThick = 0.08 * ppf3D;
                const panelH = gateH - 0.2 * ppf3D;

                const topBar = new THREE.Mesh(new THREE.BoxGeometry(gW, frameThick, frameThick), metalMat);
                topBar.position.set(0, gateH - frameThick / 2, 0);
                const botBar = new THREE.Mesh(new THREE.BoxGeometry(gW, frameThick, frameThick), metalMat);
                botBar.position.set(0, 0.2 * ppf3D + frameThick / 2, 0);
                const leftBar = new THREE.Mesh(new THREE.BoxGeometry(frameThick, panelH, frameThick), metalMat);
                leftBar.position.set(-gW / 2 + frameThick / 2, 0.2 * ppf3D + panelH / 2, 0);
                const rightBar = new THREE.Mesh(new THREE.BoxGeometry(frameThick, panelH, frameThick), metalMat);
                rightBar.position.set(gW / 2 - frameThick / 2, 0.2 * ppf3D + panelH / 2, 0);

                gatePanelGroup.add(topBar, botBar, leftBar, rightBar);

                const numLouvres = 10;
                for (let k = 1; k < numLouvres; k++) {
                    const ly = 0.2 * ppf3D + (k * panelH) / numLouvres;
                    const slatGeo = new THREE.BoxGeometry(gW * 0.94, 0.14 * ppf3D, 0.04 * ppf3D);
                    const slat = new THREE.Mesh(slatGeo, metalMat);
                    slat.position.set(0, ly, 0);
                    slat.castShadow = true;
                    gatePanelGroup.add(slat);
                }

                [-gW * 0.25, 0, gW * 0.25].forEach(gx => {
                    const goldStrip = new THREE.Mesh(new THREE.BoxGeometry(0.12 * ppf3D, panelH * 0.95, 0.06 * ppf3D), goldMat);
                    goldStrip.position.set(gx, 0.2 * ppf3D + panelH / 2, 0.02 * ppf3D);
                    goldStrip.castShadow = true;
                    gatePanelGroup.add(goldStrip);
                });

                gateMeshGroup.add(gatePanelGroup);

            } else if (gateStyle === 'double_leaf') {
                // Double Leaf Royal Gate
                const leafW = (gW / 2) - 0.08 * ppf3D;

                [-1, 1].forEach(sideFactor => {
                    const leafGroup = new THREE.Group();
                    const hingeX = sideFactor * (gW / 2);
                    leafGroup.position.set(hingeX, 0, 0);
                    leafGroup.rotation.y = -sideFactor * 0.25;

                    const lx = -sideFactor * (leafW / 2);
                    const frameThick = 0.08 * ppf3D;
                    const tBar = new THREE.Mesh(new THREE.BoxGeometry(leafW, frameThick, frameThick), metalMat);
                    tBar.position.set(lx, gateH, 0);
                    const bBar = new THREE.Mesh(new THREE.BoxGeometry(leafW, frameThick, frameThick), metalMat);
                    bBar.position.set(lx, 0.2 * ppf3D, 0);
                    const lStile = new THREE.Mesh(new THREE.BoxGeometry(frameThick, gateH - 0.2 * ppf3D, frameThick), metalMat);
                    lStile.position.set(lx - leafW / 2 + frameThick / 2, gateH / 2 + 0.1 * ppf3D, 0);
                    const rStile = new THREE.Mesh(new THREE.BoxGeometry(frameThick, gateH - 0.2 * ppf3D, frameThick), metalMat);
                    rStile.position.set(lx + leafW / 2 - frameThick / 2, gateH / 2 + 0.1 * ppf3D, 0);

                    leafGroup.add(tBar, bBar, lStile, rStile);

                    const numPickets = 7;
                    for (let pIdx = 1; pIdx < numPickets; pIdx++) {
                        const px = lx - (leafW / 2) + (pIdx * leafW) / numPickets;
                        const barGeo = new THREE.CylinderGeometry(0.03 * ppf3D, 0.03 * ppf3D, gateH - 0.2 * ppf3D, 8);
                        const bar = new THREE.Mesh(barGeo, metalMat);
                        bar.position.set(px, gateH / 2 + 0.1 * ppf3D, 0);
                        bar.castShadow = true;
                        leafGroup.add(bar);

                        const spearGeo = new THREE.ConeGeometry(0.08 * ppf3D, 0.35 * ppf3D, 8);
                        const spear = new THREE.Mesh(spearGeo, goldMat);
                        spear.position.set(px, gateH + 0.18 * ppf3D, 0);
                        spear.castShadow = true;
                        leafGroup.add(spear);
                    }

                    const kickGeo = new THREE.BoxGeometry(leafW * 0.95, 1.2 * ppf3D, 0.05 * ppf3D);
                    const kick = new THREE.Mesh(kickGeo, metalMat);
                    kick.position.set(lx, 0.8 * ppf3D, 0);
                    kick.castShadow = true;
                    leafGroup.add(kick);

                    const medalGeo = new THREE.CylinderGeometry(0.22 * ppf3D, 0.22 * ppf3D, 0.04 * ppf3D, 16);
                    const medal = new THREE.Mesh(medalGeo, goldMat);
                    medal.rotation.x = Math.PI / 2;
                    medal.position.set(lx, 0.8 * ppf3D, 0.04 * ppf3D);
                    leafGroup.add(medal);

                    gateMeshGroup.add(leafGroup);
                });
            }

            gateMeshGroup.userData = { isCompoundWall: true, isMainGate: true };
            compoundGroup.add(gateMeshGroup);
        }

        // Inclined Concrete Car Ramp (THREE.ExtrudeGeometry wedge)
        if (hasRamp) {
            const rampL = 4.8 * ppf3D;
            const rampW = gW - 0.2 * ppf3D;

            const rampShape = new THREE.Shape();
            rampShape.moveTo(0, plinthH);
            rampShape.lineTo(rampL, 0.02 * ppf3D);
            rampShape.lineTo(0, 0);
            rampShape.closePath();

            const rampGeo = new THREE.ExtrudeGeometry(rampShape, { depth: rampW, bevelEnabled: false });
            rampGeo.translate(0, 0, -rampW / 2);

            const rampMat = new THREE.MeshStandardMaterial({
                color: 0x64748b, // Anti-skid ribbed driveway concrete
                roughness: 0.9,
                metalness: 0.08
            });
            const rampMesh = new THREE.Mesh(rampGeo, rampMat);

            const rotY = Math.atan2(-nz, nx);
            rampMesh.rotation.y = rotY;
            rampMesh.position.set(centerX, 0, centerZ);
            rampMesh.castShadow = true;
            rampMesh.receiveShadow = true;
            rampMesh.userData = { isCompoundWall: true, isCarRamp: true };
            compoundGroup.add(rampMesh);

            // Safety Side Curbs on Left and Right sides of ramp
            [-rampW / 2, rampW / 2].forEach(czOffset => {
                const curbShape = new THREE.Shape();
                curbShape.moveTo(0, plinthH + 0.18 * ppf3D);
                curbShape.lineTo(rampL, 0.18 * ppf3D);
                curbShape.lineTo(rampL, 0);
                curbShape.lineTo(0, 0);
                curbShape.closePath();

                const curbGeo = new THREE.ExtrudeGeometry(curbShape, { depth: 0.18 * ppf3D, bevelEnabled: false });
                curbGeo.translate(0, 0, -0.09 * ppf3D);
                const curbMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
                const curbMesh = new THREE.Mesh(curbGeo, curbMat);
                curbMesh.rotation.y = rotY;
                curbMesh.position.set(
                    centerX + tx * (czOffset),
                    0,
                    centerZ + tz * (czOffset)
                );
                compoundGroup.add(curbMesh);
            });
        }
    }

    parentGroup.add(compoundGroup);
}

function create3DWall(x1, z1, x2, z2, height, thickness, material, parentGroup = houseGroup, wall = null, floor = null) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < 0.1) return;
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), material);
    mesh.position.set(centerX, height / 2, centerZ);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (wall) mesh.userData = { item: wall, floor: floor, type: 'wall' };
    parentGroup.add(mesh);

    // Register collidable wall bounding box
    const baseY = (parentGroup && parentGroup.position) ? parentGroup.position.y : 0;
    const pad = thickness / 2;
    const box = new THREE.Box3(
        new THREE.Vector3(Math.min(x1, x2) - pad, baseY, Math.min(z1, z2) - pad),
        new THREE.Vector3(Math.max(x1, x2) + pad, baseY + height, Math.max(z1, z2) + pad)
    );
    collidableWalls.push({
        box: box,
        x1: x1, z1: z1,
        x2: x2, z2: z2,
        baseY: baseY,
        topY: baseY + height,
        thickness: thickness,
        isDoor: false,
        type: 'wall'
    });
}

function create3DBalconyWall(x1, z1, x2, z2, heightFt, thickness, parentGroup = houseGroup, wall = null, floor = null, customMat = null) {
    const scale = 0.5;
    const ppf3D = state.pixelsPerFoot * scale;
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < 0.1) return;
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const angle = Math.atan2(z2 - z1, x2 - x1);

    const hFt = parseFloat(heightFt) || 3.0;
    const totalHeight = hFt * ppf3D;
    const capHeight = 0.18 * ppf3D; // ~2 inches coping stone
    const bodyHeight = Math.max(0.1, totalHeight - capHeight);
    const capOverhang = 0.12 * ppf3D; // slight coping overhang

    const group = new THREE.Group();

    // Solid lower parapet body
    const bodyMat = customMat || new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.85,
        metalness: 0.05
    });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(length, bodyHeight, thickness), bodyMat);
    bodyMesh.position.set(0, bodyHeight / 2, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Slate stone coping stone cap on top
    const capMat = new THREE.MeshStandardMaterial({
        color: 0x334155, // slate dark stone
        roughness: 0.55,
        metalness: 0.15
    });
    const capMesh = new THREE.Mesh(new THREE.BoxGeometry(length + 0.1, capHeight, thickness + capOverhang * 2), capMat);
    capMesh.position.set(0, bodyHeight + capHeight / 2, 0);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;
    group.add(capMesh);

    group.position.set(centerX, 0, centerZ);
    group.rotation.y = -angle;

    if (wall) {
        group.userData = { item: wall, floor: floor, type: 'balcony_wall' };
        bodyMesh.userData = { item: wall, floor: floor, type: 'balcony_wall' };
        capMesh.userData = { item: wall, floor: floor, type: 'balcony_wall' };
    }

    parentGroup.add(group);

    // Register collidable balcony parapet wall bounding box
    const baseY = (parentGroup && parentGroup.position) ? parentGroup.position.y : 0;
    const pad = thickness / 2;
    const box = new THREE.Box3(
        new THREE.Vector3(Math.min(x1, x2) - pad, baseY, Math.min(z1, z2) - pad),
        new THREE.Vector3(Math.max(x1, x2) + pad, baseY + totalHeight, Math.max(z1, z2) + pad)
    );
    collidableWalls.push({
        box: box,
        x1: x1, z1: z1,
        x2: x2, z2: z2,
        baseY: baseY,
        topY: baseY + totalHeight,
        thickness: thickness,
        isDoor: false,
        type: 'balcony_wall'
    });

    return group;
}

function create3DDoor(x1, z1, x2, z2, height, thickness, subType = 'room', parentGroup = houseGroup, material = null, wall = null, floor = null) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const wallAngle = Math.atan2(z2 - z1, x2 - x1);

    const doorHeight = height * 0.7;
    const topWallHeight = height - doorHeight;
    const lintelMat = material || new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05 });
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(length, topWallHeight, thickness), lintelMat);
    topMesh.position.set(centerX, height - topWallHeight / 2, centerZ);
    topMesh.rotation.y = -wallAngle;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    if (wall) topMesh.userData = { item: wall, floor: floor, type: 'door' };
    parentGroup.add(topMesh);

    const hingeGroup = new THREE.Group();
    hingeGroup.position.set(x1, doorHeight / 2, z1);
    hingeGroup.rotation.y = -wallAngle;
    if (wall) hingeGroup.userData = { item: wall, floor: floor, type: 'door' };

    let doorPanelMesh = null;
    if (subType === 'channel') {
        const barGeo = new THREE.BoxGeometry(thickness * 0.3, doorHeight, thickness * 0.3);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x71717a });
        const compressedLength = length * 0.25;
        for (let i = 0; i < 6; i++) {
            const bar = new THREE.Mesh(barGeo, barMat);
            bar.position.set(compressedLength * (i / 5), 0, 0);
            bar.castShadow = true;
            if (wall) bar.userData = { item: wall, floor: floor, type: 'door' };
            hingeGroup.add(bar);
        }
    } else {
        const panelColor = subType === 'entrance' ? 0x5c2e0e : 0x8b4513;
        const panelThickness = subType === 'entrance' ? thickness * 0.8 : thickness * 0.5;
        const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(length, doorHeight, panelThickness), new THREE.MeshStandardMaterial({ color: panelColor }));
        doorPanel.position.set(length / 2, 0, 0);
        doorPanel.castShadow = true;
        if (wall) doorPanel.userData = { item: wall, floor: floor, type: 'door' };

        // Polished Brass Door Handle Knob
        const knobGeo = new THREE.CylinderGeometry(thickness * 0.16, thickness * 0.16, panelThickness * 2.2, 12);
        const knobMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 });
        const knobMesh = new THREE.Mesh(knobGeo, knobMat);
        knobMesh.rotation.x = Math.PI / 2;
        knobMesh.position.set(length * 0.82, 0, 0);
        doorPanel.add(knobMesh);

        hingeGroup.add(doorPanel);
        doorPanelMesh = doorPanel;
    }
    parentGroup.add(hingeGroup);

    // Register Interactive Door & Collidable Wall Bounding Box
    const baseY = (parentGroup && parentGroup.position) ? parentGroup.position.y : 0;
    const pad = thickness / 2;
    const doorBox = new THREE.Box3(
        new THREE.Vector3(Math.min(x1, x2) - pad, baseY, Math.min(z1, z2) - pad),
        new THREE.Vector3(Math.max(x1, x2) + pad, baseY + doorHeight, Math.max(z1, z2) + pad)
    );

    const doorObj = {
        id: 'door_' + (floor ? (floor.name || '0') : '0') + '_' + Math.round(x1) + '_' + Math.round(z1),
        hingeGroup: hingeGroup,
        doorPanel: doorPanelMesh,
        baseAngle: -wallAngle,
        currentAngle: 0,
        targetAngle: 0,
        isOpen: false,
        x1: x1,
        z1: z1,
        x2: x2,
        z2: z2,
        centerX: centerX,
        centerZ: centerZ,
        baseY: baseY,
        doorHeight: doorHeight,
        thickness: thickness,
        subType: subType,
        box: doorBox,
        _removedWallEntry: null
    };
    interactiveDoors.push(doorObj);

    collidableWalls.push({
        box: doorBox,
        x1: x1,
        z1: z1,
        x2: x2,
        z2: z2,
        baseY: baseY,
        topY: baseY + doorHeight,
        thickness: thickness,
        isDoor: true,
        doorRef: doorObj,
        type: 'door'
    });
}

function create3DWindow(x1, z1, x2, z2, height, thickness, material, parentGroup = houseGroup, wall = null, floor = null) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const angle = Math.atan2(z2 - z1, x2 - x1);

    const bottomHeight = height * 0.3;
    const glassHeight = height * 0.4;
    const topHeight = height * 0.3;
    const bottomMesh = new THREE.Mesh(new THREE.BoxGeometry(length, bottomHeight, thickness), material);
    bottomMesh.position.set(centerX, bottomHeight / 2, centerZ);
    bottomMesh.rotation.y = -angle;
    bottomMesh.castShadow = true;
    bottomMesh.receiveShadow = true;
    if (wall) bottomMesh.userData = { item: wall, floor: floor, type: 'window' };

    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x87ceeb,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.4,
        envMapIntensity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(length, glassHeight, thickness * 0.1), glassMat);
    glassMesh.position.set(centerX, bottomHeight + glassHeight / 2, centerZ);
    glassMesh.rotation.y = -angle;
    if (wall) glassMesh.userData = { item: wall, floor: floor, type: 'window' };

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
    const frameGeo = new THREE.BoxGeometry(length + 0.5, glassHeight + 0.5, thickness * 0.15);
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(centerX, bottomHeight + glassHeight / 2, centerZ);
    frameMesh.rotation.y = -angle;
    if (wall) frameMesh.userData = { item: wall, floor: floor, type: 'window' };

    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(length, topHeight, thickness), material);
    topMesh.position.set(centerX, height - topHeight / 2, centerZ);
    topMesh.rotation.y = -angle;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    if (wall) topMesh.userData = { item: wall, floor: floor, type: 'window' };

    parentGroup.add(bottomMesh, frameMesh, glassMesh, topMesh);

    // Register collidable window bounding box (sill & frame block walking through)
    const baseY = (parentGroup && parentGroup.position) ? parentGroup.position.y : 0;
    const pad = thickness / 2;
    const box = new THREE.Box3(
        new THREE.Vector3(Math.min(x1, x2) - pad, baseY, Math.min(z1, z2) - pad),
        new THREE.Vector3(Math.max(x1, x2) + pad, baseY + height, Math.max(z1, z2) + pad)
    );
    collidableWalls.push({
        box: box,
        x1: x1, z1: z1,
        x2: x2, z2: z2,
        baseY: baseY,
        topY: baseY + height,
        thickness: thickness,
        isDoor: false,
        type: 'window'
    });
}

function switchView(view) {
    const btn2D = document.getElementById('view-2d');
    const btnElev = document.getElementById('view-elevation');
    const btn3D = document.getElementById('view-3d');
    const btnWalk = document.getElementById('view-walk');
    const canvasCont = document.getElementById('canvas-container');
    const elevCont = document.getElementById('elevation-container');
    const webglCont = document.getElementById('webgl-container');
    const zoomControls = document.getElementById('zoom-controls');
    const instructions = document.getElementById('walk-instructions');

    if (view !== 'walk' && isWalkthroughMode) {
        if (walkthroughControls && walkthroughControls.isLocked) walkthroughControls.unlock();
        isWalkthroughMode = false;
    }

    if (view !== 'walk') {
        const doorHud = document.getElementById('door-interaction-hud');
        if (doorHud) doorHud.style.display = 'none';
        activeNearestDoor = null;
    }

    if (view !== '3d') {
        deselect3DObject();
    }

    if (view === '2d') {
        if (btn2D) btn2D.className = "px-4 py-2 bg-blue-600 text-white text-sm font-bold flex items-center transition";
        if (btnElev) btnElev.className = "px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 border-l border-gray-200 text-sm font-bold flex items-center transition cursor-pointer";
        if (btn3D) btn3D.className = "px-4 py-2 bg-white text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center transition";
        if (btnWalk) btnWalk.className = "px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 text-sm font-bold flex items-center transition";
        if (canvasCont) canvasCont.style.display = 'block';
        if (elevCont) elevCont.style.display = 'none';
        if (webglCont) webglCont.style.display = 'none';
        if (zoomControls) zoomControls.style.display = 'flex';
        if (instructions) instructions.style.display = 'none';
        if (typeof resizeCanvas === 'function') resizeCanvas();
    } else if (view === 'elevation') {
        if (btn2D) btn2D.className = "px-4 py-2 bg-white text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center transition";
        if (btnElev) btnElev.className = "px-4 py-2 bg-indigo-600 text-white border-l border-gray-200 text-sm font-bold flex items-center transition cursor-pointer";
        if (btn3D) btn3D.className = "px-4 py-2 bg-white text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center transition";
        if (btnWalk) btnWalk.className = "px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 text-sm font-bold flex items-center transition";
        if (canvasCont) canvasCont.style.display = 'none';
        if (elevCont) elevCont.style.display = 'flex';
        if (webglCont) webglCont.style.display = 'none';
        if (zoomControls) zoomControls.style.display = 'none';
        if (instructions) instructions.style.display = 'none';
        if (typeof renderActiveElevation === 'function') renderActiveElevation();
    } else if (view === '3d') {
        if (btn2D) btn2D.className = "px-4 py-2 bg-white text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center transition";
        if (btnElev) btnElev.className = "px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 border-l border-gray-200 text-sm font-bold flex items-center transition cursor-pointer";
        if (btn3D) btn3D.className = "px-4 py-2 bg-blue-600 text-white text-sm font-bold flex items-center transition";
        if (btnWalk) btnWalk.className = "px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 text-sm font-bold flex items-center transition";
        if (canvasCont) canvasCont.style.display = 'none';
        if (elevCont) elevCont.style.display = 'none';
        if (webglCont) webglCont.style.display = 'block';
        if (zoomControls) zoomControls.style.display = 'none';
        if (instructions) instructions.style.display = 'none';

        generate3D();
        if (camera && orbitControls && renderer && webglCont) {
            const scale = 0.5;
            const ppf3D = state.pixelsPerFoot * scale;
            const wallHeight = 11 * ppf3D;
            const floorCount = (state.floors && state.floors.length) || 1;
            const totalHeight = floorCount * wallHeight;
            camera.position.set(0, Math.max(150, totalHeight * 1.5 + 80), Math.max(220, totalHeight * 1.8 + 100));
            orbitControls.target.set(0, totalHeight / 2, 0);
            orbitControls.update();
            const wWidth = webglCont.clientWidth || (window.innerWidth - 384);
            const wHeight = webglCont.clientHeight || window.innerHeight;
            camera.aspect = wWidth / (wHeight || 1);
            camera.updateProjectionMatrix();
            renderer.setSize(wWidth, wHeight);
        }
    } else if (view === 'walk') {
        if (btn2D) btn2D.className = "px-4 py-2 bg-white text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center transition";
        if (btnElev) btnElev.className = "px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 border-l border-gray-200 text-sm font-bold flex items-center transition cursor-pointer";
        if (btn3D) btn3D.className = "px-4 py-2 bg-white text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center transition";
        if (btnWalk) btnWalk.className = "px-4 py-2 bg-purple-600 text-white text-sm font-bold flex items-center transition";
        if (canvasCont) canvasCont.style.display = 'none';
        if (elevCont) elevCont.style.display = 'none';
        if (webglCont) webglCont.style.display = 'block';
        if (zoomControls) zoomControls.style.display = 'none';
        if (instructions) instructions.style.display = 'flex';

        generate3D();

        if (camera && renderer && webglCont) {
            const wWidth = webglCont.clientWidth || (window.innerWidth - 384);
            const wHeight = webglCont.clientHeight || window.innerHeight;
            camera.aspect = wWidth / (wHeight || 1);
            camera.updateProjectionMatrix();
            renderer.setSize(wWidth, wHeight);

            const scale = 0.5;
            const ppf3D = state.pixelsPerFoot * scale;
            const wallHeight = 11.0 * ppf3D;
            const currentFloorIdx = state.currentFloorIndex || 0;
            const currentBaseY = currentFloorIdx * wallHeight;
            playerBaseY = currentBaseY;

            let spawnX = 0;
            let spawnZ = state.boundaryPolygon.length === 4 ? state.boundaryPolygon[0].y * 0.5 - 20 : 50;
            const safeSpawn = findSafeSpawnPosition(spawnX, spawnZ, playerBaseY, 1.2 * ppf3D, ppf3D);
            const eyeHeight = currentBaseY + 5.5 * ppf3D;
            camera.position.set(safeSpawn.x, eyeHeight, safeSpawn.z);
            camera.rotation.set(0, 0, 0);

            isWalkthroughMode = true;
            if (walkthroughControls) walkthroughControls.lock();
        }
    }
}

// ----------------------------------------------------------------------------
// 3D Direct Manipulation & Transform Gizmo Engine
// ----------------------------------------------------------------------------

function buildGizmoMesh() {
    const group = new THREE.Group();
    group.name = "transformGizmo3D";
    group.visible = false;

    const arrowLen = 14;
    const arrowRadius = 0.5;
    const coneLen = 3.5;
    const coneRadius = 1.3;

    const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    function createArrow(axis, dir, colorMat, actionName) {
        const arrowGroup = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(arrowRadius, arrowRadius, arrowLen, 12), colorMat);
        const head = new THREE.Mesh(new THREE.ConeGeometry(coneRadius, coneLen, 16), colorMat);

        if (axis === 'x') {
            stem.rotation.z = -dir * Math.PI / 2;
            stem.position.x = dir * (arrowLen / 2);
            head.rotation.z = -dir * Math.PI / 2;
            head.position.x = dir * (arrowLen + coneLen / 2);
        } else if (axis === 'z') {
            stem.rotation.x = dir * Math.PI / 2;
            stem.position.z = dir * (arrowLen / 2);
            head.rotation.x = dir * Math.PI / 2;
            head.position.z = dir * (arrowLen + coneLen / 2);
        }

        stem.userData = { isGizmo: true, action: actionName };
        head.userData = { isGizmo: true, action: actionName };
        arrowGroup.add(stem, head);
        arrowGroup.userData = { isGizmo: true, action: actionName };
        return arrowGroup;
    }

    const arrowRight = createArrow('x', 1, redMat, 'right');
    const arrowLeft = createArrow('x', -1, redMat, 'left');
    const arrowFront = createArrow('z', 1, blueMat, 'front');
    const arrowBack = createArrow('z', -1, blueMat, 'back');

    const ringGeo = new THREE.TorusGeometry(4.0, 0.45, 12, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, goldMat);
    ringMesh.userData = { isGizmo: true, action: 'rotate' };

    const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const sphereMesh = new THREE.Mesh(sphereGeo, goldMat);
    sphereMesh.userData = { isGizmo: true, action: 'center' };

    group.add(arrowRight, arrowLeft, arrowFront, arrowBack, ringMesh, sphereMesh);
    return group;
}

function getObject3DCenter(item, floor) {
    const scale = 0.5;
    const ppf3D = state.pixelsPerFoot * scale;
    const wallHeight = 11 * ppf3D;

    let cx = 0, cz = 0;
    if (item.x !== undefined && item.y !== undefined) {
        cx = item.x * scale;
        cz = item.y * scale;
    } else if (item.x1 !== undefined && item.x2 !== undefined) {
        cx = ((item.x1 + item.x2) / 2) * scale;
        cz = ((item.y1 + item.y2) / 2) * scale;
    }

    let floorIdx = 0;
    if (state.floors && floor) {
        const idx = state.floors.indexOf(floor);
        if (idx >= 0) floorIdx = idx;
    } else if (state.currentFloorIndex !== undefined) {
        floorIdx = state.currentFloorIndex;
    }

    const baseY = floorIdx * wallHeight;
    let elevation = 6 * ppf3D;
    if (item.type === 'balcony_wall') {
        elevation = (item.heightFt || 3) * ppf3D + 2;
    } else if (item.type === 'asset_stair') {
        elevation = 5.5 * ppf3D;
    } else if (item.type === 'furn_bed' || item.type === 'furn_sofa') {
        elevation = 2.5 * ppf3D + 2;
    } else if (item.type === 'mep_ceiling_fan') {
        elevation = wallHeight - 0.7 * ppf3D;
    } else if (item.type === 'mep_light_ceiling') {
        elevation = wallHeight - 0.3 * ppf3D;
    } else if (item.type === 'mep_wall_ac') {
        elevation = wallHeight - 1.8 * ppf3D;
    } else if (item.type === 'mep_switchboard') {
        elevation = 4.0 * ppf3D;
    } else if (item.type === 'mep_mcb_box') {
        elevation = 5.0 * ppf3D;
    } else if (item.type === 'mep_overhead_tank') {
        const totalFloors = (state.floors && state.floors.length > 0) ? state.floors.length : 1;
        return { x: cx, y: (totalFloors * wallHeight) + 2.5 * ppf3D, z: cz };
    } else if (item.type === 'mep_septic_tank') {
        return { x: cx, y: 0.5 * ppf3D, z: cz };
    } else if (item.type === 'mep_wc' || item.type === 'mep_drain_trap') {
        elevation = 1.0 * ppf3D;
    } else if (item.type && item.type.startsWith('mep_')) {
        elevation = 2.8 * ppf3D;
    }

    return { x: cx, y: baseY + elevation, z: cz };
}

function update3DGizmoPosition() {
    if (!gizmoGroup) return;
    if (!selected3DItem) {
        gizmoGroup.visible = false;
        return;
    }
    const center = getObject3DCenter(selected3DItem, selected3DFloor);
    gizmoGroup.position.set(center.x, center.y, center.z);
    gizmoGroup.visible = true;
}

function select3DObject(item, floor, type) {
    if (!item) return;
    selected3DItem = item;
    selected3DFloor = floor;
    selected3DType = type || item.type;

    update3DGizmoPosition();

    // Show and configure the 3D HUD
    const hud = document.getElementById('gizmo-3d-hud');
    if (hud) hud.classList.remove('hidden');

    const titleEl = document.getElementById('gizmo-obj-title');
    const subtitleEl = document.getElementById('gizmo-obj-subtitle');
    const iconEl = document.getElementById('gizmo-obj-icon');
    const balconyControls = document.getElementById('gizmo-height-container');
    const stairControls = document.getElementById('gizmo-stair-controls');
    const pillarControls = document.getElementById('gizmo-pillar-controls');
    const gStairVoidText = document.getElementById('g-stair-void-text');

    let title = 'Selected Object';
    let iconClass = 'fa-cube';

    if (item.type === 'balcony_wall') {
        const h = item.heightFt || 3;
        title = `Balcony Wall (${h} ft)`;
        iconClass = 'fa-bars-staggered';
        if (balconyControls) balconyControls.classList.remove('hidden');
        if (stairControls) stairControls.classList.add('hidden');
        if (pillarControls) pillarControls.classList.add('hidden');
        [2, 2.5, 3, 3.5, 4].forEach(val => {
            const idStr = 'g-btn-h-' + String(val).replace('.', '_');
            const b = document.getElementById(idStr);
            if (b) {
                if (Math.abs(val - parseFloat(h)) < 0.1) {
                    b.className = "px-2 py-1 rounded bg-sky-600 text-white font-bold transition text-[11px] cursor-pointer shadow-xs";
                } else {
                    b.className = "px-2 py-1 rounded bg-gray-100 text-gray-700 font-bold hover:bg-sky-100 transition text-[11px] cursor-pointer";
                }
            }
        });
    } else if (item.type === 'asset_stair') {
        if (balconyControls) balconyControls.classList.add('hidden');
        if (stairControls) stairControls.classList.remove('hidden');
        if (pillarControls) pillarControls.classList.add('hidden');
        const lName = (item.layout || 'u_shape').toUpperCase().replace('_', '-');
        title = `Staircase (${lName}, 11 ft)`;
        iconClass = 'fa-stairs';
        if (gStairVoidText) gStairVoidText.innerText = item.autoCutout !== false ? 'Void: ON' : 'Void: OFF';
    } else if (item.type === 'asset_pillar') {
        if (balconyControls) balconyControls.classList.add('hidden');
        if (stairControls) stairControls.classList.add('hidden');
        if (pillarControls) pillarControls.classList.remove('hidden');
        const pName = item.subType === 'circle' ? `Circular Column (ø${item.diameter || 1.5}')` : `Structural Pillar (${item.w || 1}x${item.d || 2}')`;
        title = pName;
        iconClass = 'fa-monument';
    } else if (item.type && item.type.startsWith('mep_')) {
        if (balconyControls) balconyControls.classList.add('hidden');
        if (stairControls) stairControls.classList.add('hidden');
        if (pillarControls) pillarControls.classList.add('hidden');
        const mepInfo = (typeof MEP_CATALOG !== 'undefined') ? MEP_CATALOG[item.type] : null;
        title = mepInfo ? mepInfo.name : 'MEP Fixture';
        iconClass = mepInfo ? mepInfo.icon : 'fa-bolt';
    } else {
        if (balconyControls) balconyControls.classList.add('hidden');
        if (stairControls) stairControls.classList.add('hidden');
        if (pillarControls) pillarControls.classList.add('hidden');
        if (item.type === 'furn_bed') { title = 'Bed (' + (item.subType || 'Double') + ')'; iconClass = 'fa-bed'; }
        else if (item.type === 'furn_sofa') { title = 'Sofa Set'; iconClass = 'fa-couch'; }
        else if (item.type === 'furn_almira') { title = 'Almira / Wardrobe'; iconClass = 'fa-door-closed'; }
        else if (item.type === 'furn_dining') { title = 'Dining Table'; iconClass = 'fa-utensils'; }
        else if (item.type === 'door') { title = 'Door (' + (item.subType === 'entrance' ? 'Main' : item.subType === 'channel' ? 'Channel Gate' : 'Internal') + ')'; iconClass = 'fa-door-open'; }
        else if (item.type === 'window') { title = 'Window'; iconClass = 'fa-table-cells-large'; }
        else if (item.type === 'asset_slab') { title = 'Kitchen Slab'; iconClass = 'fa-kitchen-set'; }
        else if (item.thickness === 'thick') { title = 'Exterior Wall'; iconClass = 'fa-border-all'; }
        else { title = 'Interior Partition'; iconClass = 'fa-border-all'; }
    }

    if (titleEl) titleEl.innerText = title;
    if (iconEl) iconEl.className = `fa-solid ${iconClass}`;

    let floorName = 'Ground Floor';
    if (floor && floor.name) {
        floorName = floor.name + (floor.name.toLowerCase().includes('floor') ? '' : ' Floor');
    } else if (state.floors && floor) {
        const idx = state.floors.indexOf(floor);
        floorName = idx === 0 ? 'Ground Floor' : `Floor ${idx}`;
    }
    if (subtitleEl) subtitleEl.innerText = floorName;
}

function deselect3DObject() {
    selected3DItem = null;
    selected3DFloor = null;
    selected3DType = null;
    if (gizmoGroup) gizmoGroup.visible = false;
    const hud = document.getElementById('gizmo-3d-hud');
    if (hud) hud.classList.add('hidden');
    const stairControls = document.getElementById('gizmo-stair-controls');
    if (stairControls) stairControls.classList.add('hidden');
    const balconyControls = document.getElementById('gizmo-height-container');
    if (balconyControls) balconyControls.classList.add('hidden');
    const pillarControls = document.getElementById('gizmo-pillar-controls');
    if (pillarControls) pillarControls.classList.add('hidden');
}

function nudge3DObject(dir) {
    if (!selected3DItem) return;
    const ppf = state.pixelsPerFoot || 15;
    let dx = 0, dy = 0;
    if (dir === 'left') dx = -ppf;
    else if (dir === 'right') dx = ppf;
    else if (dir === 'front') dy = ppf;
    else if (dir === 'back') dy = -ppf;

    if (selected3DItem.x1 !== undefined && selected3DItem.x2 !== undefined) {
        selected3DItem.x1 += dx;
        selected3DItem.x2 += dx;
        selected3DItem.y1 += dy;
        selected3DItem.y2 += dy;
    } else if (selected3DItem.x !== undefined && selected3DItem.y !== undefined) {
        selected3DItem.x += dx;
        selected3DItem.y += dy;
    }

    if (typeof saveHistory === 'function') saveHistory();
    generate3D();
    if (typeof draw2D === 'function') draw2D();
    update3DGizmoPosition();
}

function rotate3DObject(angleDeg = 90) {
    if (!selected3DItem) return;
    if (selected3DItem.type === 'asset_pillar' || selected3DItem.type === 'asset_stair' || (selected3DItem.rotation !== undefined && selected3DItem.x !== undefined)) {
        selected3DItem.rotation = ((selected3DItem.rotation || 0) + angleDeg) % 360;
    } else if (selected3DItem.x1 !== undefined && selected3DItem.x2 !== undefined) {
        const cx = (selected3DItem.x1 + selected3DItem.x2) / 2;
        const cy = (selected3DItem.y1 + selected3DItem.y2) / 2;
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const nx1 = cx + (selected3DItem.x1 - cx) * cos - (selected3DItem.y1 - cy) * sin;
        const ny1 = cy + (selected3DItem.x1 - cx) * sin + (selected3DItem.y1 - cy) * cos;
        const nx2 = cx + (selected3DItem.x2 - cx) * cos - (selected3DItem.y2 - cy) * sin;
        const ny2 = cy + (selected3DItem.x2 - cx) * sin + (selected3DItem.y2 - cy) * cos;

        selected3DItem.x1 = Math.round(nx1);
        selected3DItem.y1 = Math.round(ny1);
        selected3DItem.x2 = Math.round(nx2);
        selected3DItem.y2 = Math.round(ny2);
    }

    if (typeof saveHistory === 'function') saveHistory();
    generate3D();
    if (typeof draw2D === 'function') draw2D();
    update3DGizmoPosition();
}

function setBalconyWallHeight(h) {
    if (!selected3DItem || selected3DItem.type !== 'balcony_wall') return;
    const numH = parseFloat(h);
    selected3DItem.heightFt = numH;

    // Sync with 2D edit overlay dropdown if present
    const sel = document.getElementById('edit-balcony-height');
    if (sel) sel.value = String(numH);

    // Update active button styling in 3D HUD
    [2, 2.5, 3, 3.5, 4].forEach(val => {
        const idStr = 'g-btn-h-' + String(val).replace('.', '_');
        const b = document.getElementById(idStr);
        if (b) {
            if (Math.abs(val - numH) < 0.1) {
                b.className = "px-2 py-1 rounded bg-sky-600 text-white font-bold transition text-[11px] cursor-pointer shadow-xs";
            } else {
                b.className = "px-2 py-1 rounded bg-gray-100 text-gray-700 font-bold hover:bg-sky-100 transition text-[11px] cursor-pointer";
            }
        }
    });

    const titleEl = document.getElementById('gizmo-obj-title');
    if (titleEl) titleEl.innerText = `Balcony Wall (${numH} ft)`;

    if (typeof saveHistory === 'function') saveHistory();
    generate3D();
    if (typeof draw2D === 'function') draw2D();
    update3DGizmoPosition();
}

function delete3DSelected() {
    if (!selected3DItem) return;
    const item = selected3DItem;
    const floor = selected3DFloor || (state.floors ? state.floors[state.currentFloorIndex] : null);

    if (floor) {
        if (floor.partitions) floor.partitions = floor.partitions.filter(p => p !== item);
        if (floor.outerWalls) floor.outerWalls = floor.outerWalls.filter(w => w !== item);
        if (floor.assets) floor.assets = floor.assets.filter(a => a !== item);
        if (floor.rooms) floor.rooms = floor.rooms.filter(r => r !== item);
        if (floor.measurements) floor.measurements = floor.measurements.filter(m => m !== item);
        if (floor.mepAssets) floor.mepAssets = floor.mepAssets.filter(m => m !== item);
    }

    if (state.partitions) state.partitions = state.partitions.filter(p => p !== item);
    if (state.outerWalls) state.outerWalls = state.outerWalls.filter(w => w !== item);
    if (state.assets) state.assets = state.assets.filter(a => a !== item);
    if (state.rooms) state.rooms = state.rooms.filter(r => r !== item);
    if (state.measurements) state.measurements = state.measurements.filter(m => m !== item);
    if (state.mepAssets) state.mepAssets = state.mepAssets.filter(m => m !== item);

    deselect3DObject();
    if (typeof saveHistory === 'function') saveHistory();
    generate3D();
    if (typeof draw2D === 'function') draw2D();
}

function handle3DPointerClick(e) {
    if (!renderer || !camera || !houseGroup) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseVec, camera);

    // Paint Mode: If a material swatch is active, raycast walls and floor slabs to paint directly
    if (state.activeMaterial) {
        const hits = raycaster.intersectObjects(houseGroup.children, true);
        for (let i = 0; i < hits.length; i++) {
            let obj = hits[i].object;
            let wallItem = null;
            let floorObj = null;
            let isFloor = false;

            let curr = obj;
            while (curr && curr !== houseGroup) {
                if (curr.userData) {
                    if (curr.userData.item && (curr.userData.type === 'wall' || curr.userData.type === 'balcony_wall' || curr.userData.type === 'door' || curr.userData.type === 'window')) {
                        wallItem = curr.userData.item;
                        floorObj = curr.userData.floor;
                        break;
                    }
                    if (curr.userData.isFloorSlab || curr.userData.isRoofSlab) {
                        isFloor = true;
                        floorObj = curr.userData.floor;
                        break;
                    }
                }
                curr = curr.parent;
            }

            if (wallItem) {
                if (state.activeMaterial.category !== 'wall') {
                    if (typeof showToast === 'function') showToast('Selected finish is for flooring! Please pick a wall paint or texture.', 'error');
                    return;
                }
                wallItem.customMaterial = state.activeMaterial.id;
                // Instantly apply procedural texture to the clicked mesh without rebuilding the whole scene
                const wallLen = Math.hypot((wallItem.x2 - wallItem.x1) * 0.5, (wallItem.y2 - wallItem.y1) * 0.5);
                const newMat = getThreeMaterial(state.activeMaterial.id, wallLen, 11);
                if (newMat && obj) {
                    obj.material = newMat;
                    obj.material.needsUpdate = true;
                }
                if (typeof saveHistory === 'function') saveHistory();
                if (typeof draw2D === 'function') draw2D();
                if (typeof showToast === 'function') showToast(`Painted wall with ${state.activeMaterial.name}!`, 'success');
                return;
            }

            if (isFloor) {
                if (state.activeMaterial.category !== 'floor') {
                    if (typeof showToast === 'function') showToast('Selected finish is for walls! Please pick a flooring finish.', 'error');
                    return;
                }
                const targetFloor = floorObj || (typeof getCurrentFloor === 'function' ? getCurrentFloor() : null);
                if (targetFloor) targetFloor.floorMaterial = state.activeMaterial.id;
                if (state.currentFloorIndex === 0) {
                    state.floorMaterial = state.activeMaterial.id;
                }
                // Instantly apply procedural texture to clicked floor slab mesh
                const newMat = getThreeMaterial(state.activeMaterial.id);
                if (newMat && obj) {
                    obj.material = newMat;
                    obj.material.needsUpdate = true;
                }
                if (typeof saveHistory === 'function') saveHistory();
                if (typeof draw2D === 'function') draw2D();
                if (typeof showToast === 'function') showToast(`Applied ${state.activeMaterial.name} to floor!`, 'success');
                return;
            }
        }
        return;
    }

    // 1. Raycast Gizmo Handles First
    if (gizmoGroup && gizmoGroup.visible) {
        const gizmoHits = raycaster.intersectObjects(gizmoGroup.children, true);
        if (gizmoHits.length > 0) {
            const hit = gizmoHits[0];
            const action = (hit.object.userData && hit.object.userData.action) ||
                           (hit.object.parent && hit.object.parent.userData && hit.object.parent.userData.action);
            if (action) {
                if (action === 'left' || action === 'right' || action === 'front' || action === 'back') {
                    nudge3DObject(action);
                } else if (action === 'rotate') {
                    rotate3DObject(90);
                }
                return;
            }
        }
    }

    // 2. Raycast House Group Objects
    const intersects = raycaster.intersectObjects(houseGroup.children, true);
    let found = null;
    for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;
        while (obj && obj !== houseGroup) {
            if (obj.userData && obj.userData.item) {
                found = obj.userData;
                break;
            }
            obj = obj.parent;
        }
        if (found) break;
    }

    if (found) {
        select3DObject(found.item, found.floor, found.type);
    } else {
        deselect3DObject();
    }
}

// ============================================================================
// Material & Paint Studio Swatch Actions & State Controller
// ============================================================================
function selectMaterialSwatch(matId) {
    if (!matId || typeof MATERIAL_CATALOG === 'undefined' || !MATERIAL_CATALOG[matId]) return;
    state.activeMaterial = MATERIAL_CATALOG[matId];
    updateMaterialUI();
    if (typeof showToast === 'function') {
        showToast(`Armed brush with ${state.activeMaterial.name}. Click any wall or floor in 2D/3D to paint!`, 'info');
    }
}

function clearActiveMaterial() {
    state.activeMaterial = null;
    updateMaterialUI();
    if (typeof showToast === 'function') {
        showToast('Paint mode cancelled.', 'info');
    }
}

function applyMaterialToAllWalls() {
    if (!state.activeMaterial || state.activeMaterial.category !== 'wall') {
        if (typeof showToast === 'function') {
            showToast('Please select a Wall Finish swatch first!', 'error');
        }
        return;
    }
    const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
    const wallsToPaint = [];
    if (curFloor) {
        if (curFloor.outerWalls && curFloor.outerWalls.length > 0) wallsToPaint.push(...curFloor.outerWalls);
        else if (state.outerWalls) wallsToPaint.push(...state.outerWalls);
        if (curFloor.partitions) wallsToPaint.push(...curFloor.partitions);
    } else {
        if (state.outerWalls) wallsToPaint.push(...state.outerWalls);
        if (state.partitions) wallsToPaint.push(...state.partitions);
    }

    if (wallsToPaint.length === 0) {
        if (typeof showToast === 'function') showToast('No walls found on the current floor!', 'error');
        return;
    }

    wallsToPaint.forEach(w => {
        w.customMaterial = state.activeMaterial.id;
    });

    if (typeof saveHistory === 'function') saveHistory();
    generate3D();
    if (typeof draw2D === 'function') draw2D();
    const floorName = curFloor ? curFloor.name : 'current';
    if (typeof showToast === 'function') {
        showToast(`Applied ${state.activeMaterial.name} to all walls on ${floorName} floor!`, 'success');
    }
}

function applyMaterialToFloor() {
    if (!state.activeMaterial || state.activeMaterial.category !== 'floor') {
        if (typeof showToast === 'function') {
            showToast('Please select a Flooring Finish swatch first!', 'error');
        }
        return;
    }
    const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
    if (curFloor) {
        curFloor.floorMaterial = state.activeMaterial.id;
    }
    if (state.currentFloorIndex === 0) {
        state.floorMaterial = state.activeMaterial.id;
    }

    if (typeof saveHistory === 'function') saveHistory();
    generate3D();
    if (typeof draw2D === 'function') draw2D();
    const floorName = curFloor ? curFloor.name : 'current';
    if (typeof showToast === 'function') {
        showToast(`Applied ${state.activeMaterial.name} to entire ${floorName} floor slab!`, 'success');
    }
}

function resetMaterialsToDefault() {
    const curFloor = (typeof getCurrentFloor === 'function') ? getCurrentFloor() : null;
    if (curFloor) {
        curFloor.floorMaterial = null;
        if (curFloor.outerWalls) curFloor.outerWalls.forEach(w => delete w.customMaterial);
        if (curFloor.partitions) curFloor.partitions.forEach(w => delete w.customMaterial);
    }
    if (state.outerWalls) state.outerWalls.forEach(w => delete w.customMaterial);
    if (state.partitions) state.partitions.forEach(w => delete w.customMaterial);
    if (state.currentFloorIndex === 0) {
        state.floorMaterial = null;
    }

    state.activeMaterial = null;
    updateMaterialUI();
    if (typeof saveHistory === 'function') saveHistory();
    generate3D();
    if (typeof draw2D === 'function') draw2D();
    if (typeof showToast === 'function') {
        showToast('All finishes reset to default architectural plaster & concrete.', 'info');
    }
}

function updateMaterialUI() {
    const activeId = state.activeMaterial ? state.activeMaterial.id : null;
    document.querySelectorAll('.mat-swatch-btn').forEach(btn => {
        const matId = btn.getAttribute('data-mat-id');
        if (activeId && matId === activeId) {
            btn.classList.add('ring-2', 'ring-blue-600', 'border-blue-600', 'bg-blue-50/50');
            btn.classList.remove('border-gray-200', 'bg-white');
        } else {
            btn.classList.remove('ring-2', 'ring-blue-600', 'border-blue-600', 'bg-blue-50/50');
            btn.classList.add('border-gray-200', 'bg-white');
        }
    });

    const hud = document.getElementById('active-paint-hud');
    const hudSwatch = document.getElementById('paint-hud-swatch');
    const hudName = document.getElementById('paint-hud-name');
    if (hud && hudSwatch && hudName) {
        if (state.activeMaterial) {
            hudName.textContent = state.activeMaterial.name;
            hudSwatch.style.cssText = state.activeMaterial.previewStyle || ('background-color: ' + state.activeMaterial.colorHex);
            hud.classList.remove('hidden');
        } else {
            hud.classList.add('hidden');
        }
    }
}

window.init3D = init3D;
window.generate3D = generate3D;
window.switchView = switchView;
window.toggleRoof = toggleRoof;
window.updateSunSimulation = updateSunSimulation;
window.setSunPreset = setSunPreset;
window.toggleInteriorLights = toggleInteriorLights;
window.select3DObject = select3DObject;
window.deselect3DObject = deselect3DObject;
window.nudge3DObject = nudge3DObject;
window.rotate3DObject = rotate3DObject;
window.setBalconyWallHeight = setBalconyWallHeight;
window.delete3DSelected = delete3DSelected;
window.toggleNearestDoor = toggleNearestDoor;
window.selectMaterialSwatch = selectMaterialSwatch;
window.clearActiveMaterial = clearActiveMaterial;
window.applyMaterialToAllWalls = applyMaterialToAllWalls;
window.applyMaterialToFloor = applyMaterialToFloor;
window.resetMaterialsToDefault = resetMaterialsToDefault;
window.updateMaterialUI = updateMaterialUI;
window.createProceduralTexture = createProceduralTexture;
window.getThreeMaterial = getThreeMaterial;

