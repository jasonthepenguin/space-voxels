import * as THREE from 'three';
import { isKeyPressed } from './desktopControls.js';

// Ship movement parameters
export const SHIP_SPEED = 15; // Constant forward speed
export const SHIP_BOOST_MULTIPLIER = 3; // 20% speed boost
export const SHIP_TURN_SPEED = 1.5; // How quickly the ship rotates
export const SHIP_PITCH_SPEED = 1.0; // How quickly the ship pitches up/down
export const SHIP_ROLL_SPEED = 1.2; // How quickly the ship rolls


// Boundary checks
// Playable boundary
const BOUNDARY_MIN_X = -240;
const BOUNDARY_MAX_X = 240;
const BOUNDARY_MIN_Y = -240;
const BOUNDARY_MAX_Y = 240;
const BOUNDARY_MIN_Z = -240;
const BOUNDARY_MAX_Z = 240;

// Create player function
export function createPlayer(scene, shipType = 'default') {
    // Create a group to hold all spaceship parts
    const player = new THREE.Group();
    player.position.set(0, 20, 70);
    player.rotation.order = 'YXZ'; // Set rotation order to match camera
    
    // Store the ship type on the player object for reference
    player.userData.shipType = shipType;
    
    // Create the selected ship type
    switch(shipType) {
        case 'Flowers Ship':
            createFlowersShip(player);
            break;
        case 'Angel Ship':
            createAngelShip(player);
            break;
        case 'Chris Ship':
            createChrisShip(player);
            break;
        case 'default':
        default:
            createDefaultShip(player);
            break;
    }
    
    scene.add(player);
    return player;
}

// Default ship (blue)
function createDefaultShip(player) {
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc });
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x66ccff, 
        transparent: true, 
        opacity: 0.7 
    });
    
    // Main body - slightly elongated
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    player.add(body);
    
    // Cockpit - on top front
    const cockpitGeometry = new THREE.BoxGeometry(1, 0.7, 1.2);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.8, -0.8);
    player.add(cockpit);
    
    // Wings - on sides
    const wingGeometry = new THREE.BoxGeometry(4, 0.3, 2);
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-2, -0.2, 0);
    player.add(leftWing);
    
    // Right wing
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(2, -0.2, 0);
    player.add(rightWing);
    
    // Engine blocks - at the back
    const engineGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    
    // Left engine
    const leftEngine = new THREE.Mesh(engineGeometry, accentMaterial);
    leftEngine.position.set(-0.8, -0.1, 1.8);
    player.add(leftEngine);
    
    // Right engine
    const rightEngine = new THREE.Mesh(engineGeometry, accentMaterial);
    rightEngine.position.set(0.8, -0.1, 1.8);
    player.add(rightEngine);
    
    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Flowers Ship (bird-like with L-shaped wings and starship tail - now with light black and yellow colors)
function createFlowersShip(player) {
    // Updated Materials with new color scheme
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Light black (dark gray) body
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 }); // Yellow wings
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc }); // Silver accent (changed from orange)
    const engineMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 }); // Darker gray engines
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444, 
        transparent: true, 
        opacity: 0.7 
    });
    
    // Main body - sharper, more angular bird-shaped body
    const bodyGeometry = new THREE.BoxGeometry(1.8, 1.6, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    player.add(body);
    
    // Cockpit - more angular, positioned like a bird's head
    const cockpitGeometry = new THREE.BoxGeometry(1.2, 1.0, 1.4);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.9, -1.8);
    player.add(cockpit);
    
    // Beak - sharper, more pointed front
    const beakGeometry = new THREE.BoxGeometry(0.5, 0.4, 1.4);
    const beak = new THREE.Mesh(beakGeometry, accentMaterial);
    beak.position.set(0, 0.7, -3.0);
    player.add(beak);
    
    // Wings - L-shaped design with forward and backward sections
    // Left wing - forward section
    const leftWingGeometry = new THREE.BoxGeometry(4.5, 0.3, 1.8);
    const leftWing = new THREE.Mesh(leftWingGeometry, wingMaterial);
    leftWing.position.set(-2.5, 0.3, -0.2);
    // Angle the wing slightly upward and backward
    leftWing.rotation.z = Math.PI / 10;
    leftWing.rotation.y = -Math.PI / 15;
    player.add(leftWing);
    
    // Left wing - backward L-section
    const leftWingBackGeometry = new THREE.BoxGeometry(1.2, 0.3, 3.5);
    const leftWingBack = new THREE.Mesh(leftWingBackGeometry, wingMaterial);
    leftWingBack.position.set(-4.2, 0.4, 1.0);
    // Angle the wing section
    leftWingBack.rotation.z = Math.PI / 10;
    player.add(leftWingBack);
    
    // Right wing - forward section
    const rightWingGeometry = new THREE.BoxGeometry(4.5, 0.3, 1.8);
    const rightWing = new THREE.Mesh(rightWingGeometry, wingMaterial);
    rightWing.position.set(2.5, 0.3, -0.2);
    // Angle the wing slightly upward and backward
    rightWing.rotation.z = -Math.PI / 10;
    rightWing.rotation.y = Math.PI / 15;
    player.add(rightWing);
    
    // Right wing - backward L-section
    const rightWingBackGeometry = new THREE.BoxGeometry(1.2, 0.3, 3.5);
    const rightWingBack = new THREE.Mesh(rightWingBackGeometry, wingMaterial);
    rightWingBack.position.set(4.2, 0.4, 1.0);
    // Angle the wing section
    rightWingBack.rotation.z = -Math.PI / 10;
    player.add(rightWingBack);
    
    // Wing tips - sharper, more angular
    const leftWingTipGeometry = new THREE.BoxGeometry(1.8, 0.25, 1.0);
    const leftWingTip = new THREE.Mesh(leftWingTipGeometry, wingMaterial);
    leftWingTip.position.set(-4.8, 0.5, -0.8);
    leftWingTip.rotation.z = Math.PI / 8;
    leftWingTip.rotation.y = Math.PI / 12; // Angle forward slightly
    player.add(leftWingTip);
    
    const rightWingTipGeometry = new THREE.BoxGeometry(1.8, 0.25, 1.0);
    const rightWingTip = new THREE.Mesh(rightWingTipGeometry, wingMaterial);
    rightWingTip.position.set(4.8, 0.5, -0.8);
    rightWingTip.rotation.z = -Math.PI / 8;
    rightWingTip.rotation.y = -Math.PI / 12; // Angle forward slightly
    player.add(rightWingTip);
    
    // Body accent pieces - to make it sharper
    const upperAccentGeometry = new THREE.BoxGeometry(0.8, 0.4, 2.5);
    const upperAccent = new THREE.Mesh(upperAccentGeometry, accentMaterial);
    upperAccent.position.set(0, 1.0, 0);
    player.add(upperAccent);
    
    // STARSHIP-LIKE TAIL SECTION
    
    // Main tail fin - vertical stabilizer
    const verticalFinGeometry = new THREE.BoxGeometry(0.3, 1.8, 1.5);
    const verticalFin = new THREE.Mesh(verticalFinGeometry, bodyMaterial);
    verticalFin.position.set(0, 1.0, 2.5);
    player.add(verticalFin);
    
    // Horizontal stabilizers - like a starship
    const leftStabilizerGeometry = new THREE.BoxGeometry(1.6, 0.3, 1.2);
    const leftStabilizer = new THREE.Mesh(leftStabilizerGeometry, wingMaterial);
    leftStabilizer.position.set(-0.9, 0.2, 2.5);
    // Angle slightly for style
    leftStabilizer.rotation.z = Math.PI / 15;
    player.add(leftStabilizer);
    
    const rightStabilizerGeometry = new THREE.BoxGeometry(1.6, 0.3, 1.2);
    const rightStabilizer = new THREE.Mesh(rightStabilizerGeometry, wingMaterial);
    rightStabilizer.position.set(0.9, 0.2, 2.5);
    // Angle slightly for style
    rightStabilizer.rotation.z = -Math.PI / 15;
    player.add(rightStabilizer);
    
    // Engine section - more mechanical looking
    const engineBaseGeometry = new THREE.BoxGeometry(1.6, 0.8, 0.8);
    const engineBase = new THREE.Mesh(engineBaseGeometry, bodyMaterial);
    engineBase.position.set(0, 0, 2.8);
    player.add(engineBase);
    
    // Engine nozzles - three of them for a starship look
    const engineNozzleGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.6);
    
    // Left engine nozzle
    const leftNozzle = new THREE.Mesh(engineNozzleGeometry, engineMaterial);
    leftNozzle.position.set(-0.5, 0, 3.4);
    player.add(leftNozzle);
    
    // Center engine nozzle
    const centerNozzle = new THREE.Mesh(engineNozzleGeometry, engineMaterial);
    centerNozzle.position.set(0, 0, 3.4);
    player.add(centerNozzle);
    
    // Right engine nozzle
    const rightNozzle = new THREE.Mesh(engineNozzleGeometry, engineMaterial);
    rightNozzle.position.set(0.5, 0, 3.4);
    player.add(rightNozzle);
    
    // Add some engine glow/exhaust effect
    const exhaustGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.3);
    const exhaustMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffaa00, 
        emissive: 0xffaa00,
        emissiveIntensity: 1
    });
    
    // Add exhaust to each engine
    for (let i = -1; i <= 1; i++) {
        const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
        exhaust.position.set(i * 0.5, 0, 3.7);
        player.add(exhaust);
    }
    
    // Add some engine details to the back of the L-shaped wings
    const leftEngineGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const leftEngine = new THREE.Mesh(leftEngineGeometry, engineMaterial);
    leftEngine.position.set(-4.2, 0.4, 2.5);
    player.add(leftEngine);
    
    const rightEngineGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const rightEngine = new THREE.Mesh(rightEngineGeometry, engineMaterial);
    rightEngine.position.set(4.2, 0.4, 2.5);
    player.add(rightEngine);
    
    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Angel Ship (now made of blocks instead of curved shapes)
function createAngelShip(player) {
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }); // White body
    const wingMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.7
    });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 }); // Gold accents
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xe6e6fa, 
        transparent: true, 
        opacity: 0.8
    });
    
    // Main body - now a box instead of cylinder
    const bodyGeometry = new THREE.BoxGeometry(1.6, 1, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    player.add(body);
    
    // Cockpit - now a box instead of sphere
    const cockpitGeometry = new THREE.BoxGeometry(1.4, 0.8, 1.4);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.8, -1);
    player.add(cockpit);
    
    // Angel wings - now made of multiple boxes
    // Left wing
    createBlockWing(player, -1, 0, 0, wingMaterial, true);
    
    // Right wing
    createBlockWing(player, 1, 0, 0, wingMaterial, false);
    
    // Halo - now a square frame made of small boxes
    const haloSize = 0.5;
    const haloThickness = 0.1;
    
    // Create a square halo with 8 small boxes
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const haloPartGeometry = new THREE.BoxGeometry(haloThickness, haloThickness, haloThickness);
        const haloPart = new THREE.Mesh(haloPartGeometry, accentMaterial);
        
        haloPart.position.set(
            Math.sin(angle) * haloSize,
            1 + Math.cos(angle) * haloSize,
            -0.5
        );
        player.add(haloPart);
    }
    
    // Tail feathers - now a box arrangement
    const tailGeometry = new THREE.BoxGeometry(1.6, 0.4, 2);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0, 2);
    player.add(tail);
    
    // Additional tail detail
    const tailTipGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.8);
    const tailTip = new THREE.Mesh(tailTipGeometry, wingMaterial);
    tailTip.position.set(0, 0, 3);
    player.add(tailTip);
    
    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Helper function to create block-based wings
function createBlockWing(player, xPos, yPos, zPos, material, isLeft) {
    // Main wing section
    const wingMainGeometry = new THREE.BoxGeometry(0.2, 0.8, 3);
    const wingMain = new THREE.Mesh(wingMainGeometry, material);
    wingMain.position.set(xPos * 2, yPos, zPos);
    player.add(wingMain);
    
    // Wing tip section
    const wingTipGeometry = new THREE.BoxGeometry(0.2, 1.2, 1.5);
    const wingTip = new THREE.Mesh(wingTipGeometry, material);
    wingTip.position.set(xPos * 3, yPos, zPos - 0.5);
    player.add(wingTip);
    
    // Wing connector
    const wingConnectorGeometry = new THREE.BoxGeometry(xPos * 2, 0.2, 0.8);
    const wingConnector = new THREE.Mesh(wingConnectorGeometry, material);
    wingConnector.position.set(xPos, yPos, zPos);
    player.add(wingConnector);
}

// Chris Ship (already uses mostly BoxGeometry, minor adjustments)
function createChrisShip(player) {
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcc3333 }); // Red body
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 }); // Dark wings
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc }); // Blue accents
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffcccc, 
        transparent: true, 
        opacity: 0.7 
    });
    
    // Main body - angular and aggressive
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 5);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    player.add(body);
    
    // Front nose - now a box instead of cone
    const noseGeometry = new THREE.BoxGeometry(1.5, 0.8, 2);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(0, 0, -3);
    player.add(nose);
    
    // Nose tip - smaller box
    const noseTipGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.5);
    const noseTip = new THREE.Mesh(noseTipGeometry, bodyMaterial);
    noseTip.position.set(0, 0, -4);
    player.add(noseTip);
    
    // Cockpit - angular
    const cockpitGeometry = new THREE.BoxGeometry(1.2, 0.8, 1.5);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.8, -1);
    player.add(cockpit);
    
    // Wings - now made of multiple boxes
    // Left wing
    const leftWingGeometry = new THREE.BoxGeometry(0.5, 0.3, 3);
    const leftWing = new THREE.Mesh(leftWingGeometry, wingMaterial);
    leftWing.position.set(-2, -0.3, 0);
    leftWing.rotation.y = Math.PI / 8; // Angle slightly
    player.add(leftWing);
    
    // Left wing tip
    const leftWingTipGeometry = new THREE.BoxGeometry(0.5, 0.5, 1.5);
    const leftWingTip = new THREE.Mesh(leftWingTipGeometry, wingMaterial);
    leftWingTip.position.set(-3, -0.2, -0.5);
    player.add(leftWingTip);
    
    // Right wing
    const rightWingGeometry = new THREE.BoxGeometry(0.5, 0.3, 3);
    const rightWing = new THREE.Mesh(rightWingGeometry, wingMaterial);
    rightWing.position.set(2, -0.3, 0);
    rightWing.rotation.y = -Math.PI / 8; // Angle slightly
    player.add(rightWing);
    
    // Right wing tip
    const rightWingTipGeometry = new THREE.BoxGeometry(0.5, 0.5, 1.5);
    const rightWingTip = new THREE.Mesh(rightWingTipGeometry, wingMaterial);
    rightWingTip.position.set(3, -0.2, -0.5);
    player.add(rightWingTip);
    
    // Vertical stabilizers
    const stabilizerGeometry = new THREE.BoxGeometry(0.2, 1.5, 1);
    
    // Left stabilizer
    const leftStabilizer = new THREE.Mesh(stabilizerGeometry, wingMaterial);
    leftStabilizer.position.set(-1, 0.5, 2);
    player.add(leftStabilizer);
    
    // Right stabilizer
    const rightStabilizer = new THREE.Mesh(stabilizerGeometry, wingMaterial);
    rightStabilizer.position.set(1, 0.5, 2);
    player.add(rightStabilizer);
    
    // Engine exhausts - now boxes instead of cylinders
    // Create 3 exhausts
    for (let i = -1; i <= 1; i++) {
        const exhaust = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.6, 0.5),
            accentMaterial
        );
        exhaust.position.set(i * 0.7, 0, 2.7);
        player.add(exhaust);
    }
    
    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Handle player movement
export function handleMovement(player, delta, updateCameraPosition, controls = null) {
    if (!player) return;
    
    const isKeyPressed = controls && controls.isKeyPressed ? controls.isKeyPressed : null;
    
    const boostActive = (isKeyPressed && (isKeyPressed('ShiftLeft') || isKeyPressed('ShiftRight'))) ||
                        (controls && controls.isBoostActive && controls.isBoostActive());
    
    player.userData.boostActive = boostActive;
    const speedMultiplier = boostActive ? 2.0 : 1.0;
    const currentSpeed = SHIP_SPEED * speedMultiplier;
    
    const forwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    player.position.add(forwardDirection.multiplyScalar(currentSpeed * delta));
    
    // Boundary clamping
    player.position.x = Math.max(BOUNDARY_MIN_X, Math.min(BOUNDARY_MAX_X, player.position.x));
    player.position.y = Math.max(BOUNDARY_MIN_Y, Math.min(BOUNDARY_MAX_Y, player.position.y));
    player.position.z = Math.max(BOUNDARY_MIN_Z, Math.min(BOUNDARY_MAX_Z, player.position.z));


    let targetYawChange = 0;
    let targetPitchChange = 0;
    let targetRollChange = 0;
    
    if (controls && controls.isMobile) {
        // Get joystick values
        const joystickValues = controls.getJoystickValues();
        
        // Yaw (left/right turning) based on joystick X
        if (Math.abs(joystickValues.x) > 0.1) {
            targetYawChange = -joystickValues.x * SHIP_TURN_SPEED * delta;
            // Allow continuous rolling when turning
            targetRollChange = -joystickValues.x * SHIP_ROLL_SPEED * delta;
        } else {
            // Return roll to neutral when not turning, but only if within a small range
            const normalizedRoll = ((player.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            
            if (normalizedRoll > 0.1 && normalizedRoll < Math.PI) {
                // If between 0 and PI, roll clockwise toward 0
                targetRollChange = -SHIP_ROLL_SPEED * delta;
            } else if (normalizedRoll > Math.PI && normalizedRoll < Math.PI * 2 - 0.1) {
                // If between PI and 2*PI, roll counter-clockwise toward 0
                targetRollChange = SHIP_ROLL_SPEED * delta;
            }
        }
        
        // Pitch (up/down) based on joystick Y
        if (Math.abs(joystickValues.y) > 0.1) {
            targetPitchChange = joystickValues.y * SHIP_PITCH_SPEED * delta;
        } else {
            // Auto-level pitch when not pressing up/down, but only if within a small range
            const normalizedPitch = ((player.rotation.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            
            if (normalizedPitch > 0.1 && normalizedPitch < Math.PI) {
                // If between 0 and PI, pitch down toward 0
                targetPitchChange = -SHIP_PITCH_SPEED * delta * 0.5; // Slower auto-leveling
            } else if (normalizedPitch > Math.PI && normalizedPitch < Math.PI * 2 - 0.1) {
                // If between PI and 2*PI, pitch up toward 0
                targetPitchChange = SHIP_PITCH_SPEED * delta * 0.5; // Slower auto-leveling
            }
        }
    } else if (isKeyPressed) {
        // Use isKeyPressed function directly
        if (isKeyPressed('KeyA') || isKeyPressed('ArrowLeft')) {
            targetYawChange = SHIP_TURN_SPEED * delta;
            targetRollChange = SHIP_ROLL_SPEED * delta;
        } else if (isKeyPressed('KeyD') || isKeyPressed('ArrowRight')) {
            targetYawChange = -SHIP_TURN_SPEED * delta;
            targetRollChange = -SHIP_ROLL_SPEED * delta;
        } else {
            const normalizedRoll = ((player.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (normalizedRoll > 0.1 && normalizedRoll < Math.PI) {
                targetRollChange = -SHIP_ROLL_SPEED * delta;
            } else if (normalizedRoll > Math.PI && normalizedRoll < Math.PI * 2 - 0.1) {
                targetRollChange = SHIP_ROLL_SPEED * delta;
            }
        }

        if (isKeyPressed('KeyW') || isKeyPressed('ArrowUp')) {
            targetPitchChange = -SHIP_PITCH_SPEED * delta;
        } else if (isKeyPressed('KeyS') || isKeyPressed('ArrowDown')) {
            targetPitchChange = SHIP_PITCH_SPEED * delta;
        } else {
            const normalizedPitch = ((player.rotation.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (normalizedPitch > 0.1 && normalizedPitch < Math.PI) {
                targetPitchChange = -SHIP_PITCH_SPEED * delta * 0.5;
            } else if (normalizedPitch > Math.PI && normalizedPitch < Math.PI * 2 - 0.1) {
                targetPitchChange = SHIP_PITCH_SPEED * delta * 0.5;
            }
        }
    }
    
    player.rotation.y += targetYawChange;
    player.rotation.x += targetPitchChange;
    player.rotation.z += targetRollChange;
    
    updateCameraPosition();
}

// Update camera position based on player position and rotation
export function updateCameraPosition(player, camera, cameraOffset, mobileControls = null) {
    if (!player) return; // Don't update if player doesn't exist
    
    // Create a base offset that follows the ship's orientation
    // Increased Z from 10 to 15 to move camera further back
    // Increased Y from 3 to 4 to raise camera slightly for better view
    const baseOffset = new THREE.Vector3(0, 4, 15);
    baseOffset.applyQuaternion(player.quaternion);
    
    // Apply additional camera rotation based on mouse movement or touch controls
    if (cameraOffset.angles) {
        // Create a rotation matrix for the additional camera rotation
        const rotationMatrix = new THREE.Matrix4();
        
        // First rotate around Y axis (yaw)
        rotationMatrix.makeRotationY(cameraOffset.angles.yaw);
        
        // Then rotate around X axis (pitch)
        const pitchMatrix = new THREE.Matrix4();
        pitchMatrix.makeRotationX(cameraOffset.angles.pitch);
        rotationMatrix.multiply(pitchMatrix);
        
        // Apply the rotation to the base offset
        baseOffset.applyMatrix4(rotationMatrix);
    }
    
    // Set camera position
    camera.position.copy(player.position).add(baseOffset);
    
    // Instead of looking at the player or far ahead, look at a point slightly above the player
    // Increased Z from -20 to -30 to look further ahead
    const lookOffset = new THREE.Vector3(0, 2, -30);
    lookOffset.applyQuaternion(player.quaternion);
    
    // Apply the same camera rotation to the look target
    if (cameraOffset.angles) {
        const rotationMatrix = new THREE.Matrix4();
        
        rotationMatrix.makeRotationY(cameraOffset.angles.yaw);
        const pitchMatrix = new THREE.Matrix4();
        pitchMatrix.makeRotationX(cameraOffset.angles.pitch);
        rotationMatrix.multiply(pitchMatrix);
        
        lookOffset.applyMatrix4(rotationMatrix);
    }
    
    const lookTarget = player.position.clone().add(lookOffset);
    camera.lookAt(lookTarget);
} 
