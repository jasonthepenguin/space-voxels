import * as THREE from 'three';

// Ship movement parameters
export const SHIP_SPEED = 15; // Constant forward speed
export const SHIP_TURN_SPEED = 1.5; // How quickly the ship rotates
export const SHIP_PITCH_SPEED = 1.0; // How quickly the ship pitches up/down
export const SHIP_ROLL_SPEED = 1.2; // How quickly the ship rolls

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

// Flowers Ship (unique design with flower-like elements)
function createFlowersShip(player) {
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8a2be2 }); // Purple body
    const petalMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4 }); // Pink petals
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x32cd32 }); // Green stem
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xda70d6, 
        transparent: true, 
        opacity: 0.7 
    });
    
    // Main body - rounded
    const bodyGeometry = new THREE.SphereGeometry(1.2, 16, 16);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.scale.z = 1.5; // Elongate slightly
    player.add(body);
    
    // Cockpit - dome shaped
    const cockpitGeometry = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.8, -0.5);
    cockpit.rotation.x = Math.PI;
    player.add(cockpit);
    
    // Flower petals
    const petalCount = 5;
    const petalGeometry = new THREE.BoxGeometry(0.8, 0.2, 1.5);
    
    for (let i = 0; i < petalCount; i++) {
        const petal = new THREE.Mesh(petalGeometry, petalMaterial);
        const angle = (i / petalCount) * Math.PI * 2;
        petal.position.set(Math.sin(angle) * 1.5, Math.cos(angle) * 1.5, 1);
        petal.rotation.z = angle;
        player.add(petal);
    }
    
    // Stem/tail
    const stemGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0, 0, 2);
    stem.rotation.x = Math.PI / 2;
    player.add(stem);
    
    // Leaf wings
    const leafGeometry = new THREE.ConeGeometry(1, 3, 4);
    
    // Left leaf
    const leftLeaf = new THREE.Mesh(leafGeometry, stemMaterial);
    leftLeaf.position.set(-1.5, 0, 0.5);
    leftLeaf.rotation.z = Math.PI / 2;
    leftLeaf.rotation.y = Math.PI / 4;
    player.add(leftLeaf);
    
    // Right leaf
    const rightLeaf = new THREE.Mesh(leafGeometry, stemMaterial);
    rightLeaf.position.set(1.5, 0, 0.5);
    rightLeaf.rotation.z = -Math.PI / 2;
    rightLeaf.rotation.y = -Math.PI / 4;
    player.add(rightLeaf);
    
    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, stemMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Angel Ship (ethereal, wing-focused design)
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
    
    // Main body - sleek and elongated
    const bodyGeometry = new THREE.CylinderGeometry(0.8, 0.5, 4, 8);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    player.add(body);
    
    // Cockpit - teardrop shaped
    const cockpitGeometry = new THREE.SphereGeometry(0.7, 16, 16);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.4, -1);
    cockpit.scale.z = 1.3;
    player.add(cockpit);
    
    // Angel wings - large and feathered
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.quadraticCurveTo(1, 2, 3, 0);
    wingShape.quadraticCurveTo(2, -0.5, 0, -1);
    wingShape.quadraticCurveTo(0.5, -0.5, 0, 0);
    
    const wingGeometry = new THREE.ShapeGeometry(wingShape);
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.5, 0, 0);
    leftWing.rotation.y = Math.PI / 2;
    player.add(leftWing);
    
    // Right wing (mirrored)
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.5, 0, 0);
    rightWing.rotation.y = -Math.PI / 2;
    rightWing.scale.x = -1; // Mirror
    player.add(rightWing);
    
    // Halo
    const haloGeometry = new THREE.TorusGeometry(0.5, 0.1, 8, 24);
    const halo = new THREE.Mesh(haloGeometry, accentMaterial);
    halo.position.set(0, 1, -0.5);
    halo.rotation.x = Math.PI / 4;
    player.add(halo);
    
    // Tail feathers
    const tailGeometry = new THREE.ConeGeometry(0.8, 2, 5);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0, 2);
    tail.rotation.x = Math.PI / 2;
    player.add(tail);
    
    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Chris Ship (aggressive, angular design)
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
    
    // Front nose - pointed
    const noseGeometry = new THREE.ConeGeometry(1, 2, 4);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(0, 0, -3);
    nose.rotation.x = -Math.PI / 2;
    player.add(nose);
    
    // Cockpit - angular
    const cockpitGeometry = new THREE.BoxGeometry(1.2, 0.8, 1.5);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.8, -1);
    player.add(cockpit);
    
    // Wings - swept back and angular
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(3, 2);
    wingShape.lineTo(3, 2.5);
    wingShape.lineTo(0, 0.5);
    wingShape.lineTo(0, 0);
    
    const wingExtrudeSettings = {
        steps: 1,
        depth: 0.2,
        bevelEnabled: false
    };
    
    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-1, -0.5, 0);
    leftWing.rotation.y = Math.PI / 2;
    player.add(leftWing);
    
    // Right wing (mirrored)
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(1, -0.5, 0);
    rightWing.rotation.y = -Math.PI / 2;
    rightWing.scale.x = -1; // Mirror
    player.add(rightWing);
    
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
    
    // Engine exhausts - multiple
    const exhaustGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 8);
    
    // Create 3 exhausts
    for (let i = -1; i <= 1; i++) {
        const exhaust = new THREE.Mesh(exhaustGeometry, accentMaterial);
        exhaust.position.set(i * 0.7, 0, 2.7);
        exhaust.rotation.x = Math.PI / 2;
        player.add(exhaust);
    }
    
    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Handle player movement
export function handleMovement(player, keyboard, delta, updateCameraPosition, mobileControls = null) {
    if (!player) return;
    
    // Always move forward in the direction the ship is facing
    const forwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    player.position.add(forwardDirection.multiplyScalar(SHIP_SPEED * delta));
    
    // Handle turning with smooth rotation
    let targetYawChange = 0;
    let targetPitchChange = 0;
    let targetRollChange = 0;
    
    // Check if we have mobile controls
    if (mobileControls && mobileControls.isMobile) {
        // Get joystick values
        const joystickValues = mobileControls.getJoystickValues();
        
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
    } else {
        // Keyboard controls for desktop
        // Yaw (left/right turning)
        if (keyboard['KeyA'] || keyboard['ArrowLeft']) {
            targetYawChange = SHIP_TURN_SPEED * delta;
            // Allow continuous rolling when turning left
            targetRollChange = SHIP_ROLL_SPEED * delta;
        } else if (keyboard['KeyD'] || keyboard['ArrowRight']) {
            targetYawChange = -SHIP_TURN_SPEED * delta;
            // Allow continuous rolling when turning right
            targetRollChange = -SHIP_ROLL_SPEED * delta;
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
        
        // Pitch (up/down) - now allowing for complete loops
        if (keyboard['KeyW'] || keyboard['ArrowUp']) {
            targetPitchChange = -SHIP_PITCH_SPEED * delta;
        } else if (keyboard['KeyS'] || keyboard['ArrowDown']) {
            targetPitchChange = SHIP_PITCH_SPEED * delta;
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
    }
    
    // Apply rotations to the ship
    player.rotation.y += targetYawChange;
    
    // Apply pitch without limiting it, allowing for full 360° loops
    player.rotation.x += targetPitchChange;
    
    // Apply roll without limiting it, allowing for full 360° rolls
    player.rotation.z += targetRollChange;
    
    // Update camera position
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