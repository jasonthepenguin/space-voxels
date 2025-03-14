import * as THREE from 'three';

// Ship movement parameters
export const SHIP_SPEED = 15; // Constant forward speed
export const SHIP_TURN_SPEED = 1.5; // How quickly the ship rotates
export const SHIP_PITCH_SPEED = 1.0; // How quickly the ship pitches up/down
export const SHIP_ROLL_SPEED = 1.2; // How quickly the ship rolls

// Create player function
export function createPlayer(scene) {
    // Create a group to hold all spaceship parts
    const player = new THREE.Group();
    player.position.set(0, 20, 70);
    player.rotation.order = 'YXZ'; // Set rotation order to match camera
    
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc }); // Blue body
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 }); // Gray wings
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333 }); // Red accents
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x66ccff, 
        transparent: true, 
        opacity: 0.7 
    }); // Transparent blue cockpit
    
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
    
    // Forward gun/cannon
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
    
    scene.add(player);
    return player;
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