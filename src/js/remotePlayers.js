import * as THREE from 'three';
import { createPlayer } from './player.js';
import { audioSystem } from './weapons.js';


// Remote players collection
const remotePlayers = {};

// Create a text sprite for player username
function createUsernameLabel(username) {
    // Create canvas for the text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set text styles
    context.font = 'Bold 70px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add a black outline/shadow for better visibility
    context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    context.lineWidth = 4;
    context.strokeText(username, 128, 32);
    
    // Draw the text in white
    context.fillStyle = 'rgba(255, 255, 255, 1.0)';
    context.fillText(username, 128, 32);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    
    // Scale based on text length (wider for longer names)
    const nameScale = Math.max(4, Math.min(6, username.length * 0.4));
    sprite.scale.set(nameScale, 1, 1);
    
    return sprite;
}

// Add or update a remote player
export function addOrUpdateRemotePlayer(scene, id, data)
{
    if(!remotePlayers[id])
    {
        const remotePlayer = createPlayer(scene, data.shipType || 'default');
        remotePlayer.name = `remotePlayer_${id}`;
        scene.add(remotePlayer);
        remotePlayers[id] = remotePlayer;

        // Set initial position and rotation
        remotePlayer.position.set(data.position.x, data.position.y, data.position.z);
        remotePlayer.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);

        // Store target position/rotation for interpolation
        remotePlayer.userData.targetPosition = new THREE.Vector3(
            data.position.x,
            data.position.y,
            data.position.z
        );
        remotePlayer.userData.targetRotation = new THREE.Euler(
            data.rotation.x,
            data.rotation.y,
            data.rotation.z
        );
        
        // Add username label
        // Determine username - use provided username or fallback to ID-based name
        const username = data.username || `Player_${id.substring(0, 5)}`;
        const usernameLabel = createUsernameLabel(username);
        usernameLabel.position.set(0, 3, 0); // Position above the ship
        remotePlayer.add(usernameLabel);
        remotePlayer.userData.usernameLabel = usernameLabel;
        
        console.log(`Created remote player: ${id} with username: ${username}`);

    } else {
        // Update target positions/rotations for interpolation
        // Only update if the player is currently visible (avoids lerping while dead)
        if (remotePlayers[id].visible) {
            remotePlayers[id].userData.targetPosition.set(
                data.position.x,
                data.position.y,
                data.position.z
            );
            remotePlayers[id].userData.targetRotation.set(
                data.rotation.x,
                data.rotation.y,
                data.rotation.z
            );
            
            // Update username if provided and different from current
            if (data.username && remotePlayers[id].userData.usernameLabel) {
                const currentLabel = remotePlayers[id].userData.usernameLabel;
                const currentMaterial = currentLabel.material;
                const currentTexture = currentMaterial.map;
                
                // Check if username needs updating (we don't have direct access to stored username)
                // This is a simple approach - updating on any username presence in data
                if (data.username) {
                    // Replace the label with a new one
                    remotePlayers[id].remove(currentLabel);
                    const newLabel = createUsernameLabel(data.username);
                    newLabel.position.set(0, 3, 0);
                    remotePlayers[id].add(newLabel);
                    remotePlayers[id].userData.usernameLabel = newLabel;
                }
            }
        }
    }
}


// Remove a remote player
export function removeRemotePlayer(scene, id) {
    const player = remotePlayers[id];
    if (player) {
        scene.remove(player);
        delete remotePlayers[id];
        console.log(`Removed remote player: ${id}`);
    }
}

// NEW function to temporarily hide a remote player
export function hideRemotePlayerTemporarily(id) {
    const remotePlayer = remotePlayers[id];
    if (remotePlayer) {
        remotePlayer.visible = false;
        console.log(`Hid remote player ${id} temporarily.`);
    } else {
        console.warn(`Tried to hide non-existent remote player: ${id}`);
    }
}


// Get a specific remote player
export function getRemotePlayer(id) {
    return remotePlayers[id];
}

// Get all remote players
export function getAllRemotePlayers() {
    return remotePlayers;
}

// Make username labels always face the camera
export function updateUsernameLabelPositions(camera) {
    for (const id in remotePlayers) {
        const remotePlayer = remotePlayers[id];
        if (remotePlayer && remotePlayer.visible && remotePlayer.userData.usernameLabel) {
            // Get the label
            const label = remotePlayer.userData.usernameLabel;
            
            // Make it face the camera
            const labelWorldPos = new THREE.Vector3();
            label.getWorldPosition(labelWorldPos);
            
            // Calculate direction from label to camera
            const dirToCamera = new THREE.Vector3().subVectors(camera.position, labelWorldPos).normalize();
            
            // Set the label's world quaternion to face the camera
            // This is handled automatically by THREE.Sprite - they always face the camera
        }
    }
}

// function to respawn the local player
export function respawnLocalPlayer(player, scene, updateCameraPosition, respawnPosition, isConnected) {
    console.log("Respawning local player...");
    
    if (!player) {
        console.error("Cannot respawn: player does not exist");
        return;
    }
    
    // Use the position provided by the server or default if missing
    const finalRespawnPosition = respawnPosition ? 
        new THREE.Vector3(respawnPosition.x, respawnPosition.y, respawnPosition.z) : 
        new THREE.Vector3(0, 20, 70); // Default fallback position
        
    console.log("Using final respawn position:", finalRespawnPosition);
    
    // Create a respawn explosion effect at the *new* position
    const explosionGeometry = new THREE.SphereGeometry(2, 16, 16);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00, 
        transparent: true,
        opacity: 0.8
    });
    
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(finalRespawnPosition); // Explosion at the destination
    scene.add(explosion);
    
    // Animate explosion
    let explosionScale = 1;
    const expandExplosion = () => {
        explosionScale += 0.2;
        explosion.scale.set(explosionScale, explosionScale, explosionScale);
        explosion.material.opacity -= 0.05;
        
        if (explosion.material.opacity > 0) {
            requestAnimationFrame(expandExplosion);
        } else {
            scene.remove(explosion);
        }
    };
    
    expandExplosion();
    
    // Set position immediately
    player.position.copy(finalRespawnPosition);
    
    // Play spawn sound on respawn
    if (audioSystem && audioSystem.isAudioInitialized) {
        audioSystem.playSound('search', { volume: 0.7 });
    }
    
    // Reset rotation
    player.rotation.set(0, 0, 0);
    
    // Make player visible again
    player.visible = true;
    
    // Update camera position immediately
    if (updateCameraPosition) {
        updateCameraPosition();
    }
    
    console.log("Local player respawned at", player.position);
}

// RENAMED: Respawn and show a remote player
// Updated to accept the full data object from the server event
export function showAndRespawnRemotePlayer(id, data, scene) {
    const position = data.position;
    const shipType = data.shipType; // Get shipType from the event data

    let remotePlayer = remotePlayers[id]; // Use let

    if (!remotePlayer) {
        // Player doesn't exist locally, likely because client joined while they were dead.
        console.log(`Remote player ${id} not found locally during respawn. Adding now.`);
        // Add the player using data from the respawn event
        addOrUpdateRemotePlayer(scene, id, {
            position: position,
            rotation: { x: 0, y: 0, z: 0 }, // Initial rotation upon respawn
            shipType: shipType || 'default', // Use received shipType
            username: data.username // Pass username if available
        });
        remotePlayer = remotePlayers[id]; // Re-fetch the reference
        if (!remotePlayer) {
           console.error(`Failed to add remote player ${id} during respawn flow.`);
           return; // Exit if creation failed
        }
        console.log(`Successfully added remote player ${id} during respawn flow.`);
        // The player model now exists, the rest of the function will make it visible etc.
    } else {
       console.log(`Showing and respawning existing remote player ${id} at`, position);
    }

    // Ensure the player object is visible
    remotePlayer.visible = true;

    // Teleport immediately to the server-provided position
    remotePlayer.position.set(position.x, position.y, position.z);

    // Reset rotation
    remotePlayer.rotation.set(0, 0, 0);

    // Update target position for interpolation (important after teleport)
    if (remotePlayer.userData.targetPosition) { // Check if userData exists
        remotePlayer.userData.targetPosition.copy(position);
    } else {
        // Initialize if it doesn't exist (might happen if newly created)
         remotePlayer.userData.targetPosition = new THREE.Vector3(position.x, position.y, position.z);
    }
    if (remotePlayer.userData.targetRotation) { // Check if userData exists
        remotePlayer.userData.targetRotation.set(0, 0, 0);
    } else {
        // Initialize if it doesn't exist
        remotePlayer.userData.targetRotation = new THREE.Euler(0, 0, 0);
    }

    // Create a brief respawn marker effect at the new position
    const respawnMarker = new THREE.Mesh(
        new THREE.SphereGeometry(3, 8, 8),
        new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.7
        })
    );
    respawnMarker.position.copy(position);
    scene.add(respawnMarker);

    // Animate the respawn marker
    let markerScale = 1;
    const shrinkMarker = () => {
        markerScale -= 0.05;
        respawnMarker.scale.set(markerScale, markerScale, markerScale);

        if (markerScale > 0) {
            requestAnimationFrame(shrinkMarker);
        } else {
            scene.remove(respawnMarker);
        }
    };

    shrinkMarker();

    console.log(`Remote player ${id} respawn complete, new position:`, remotePlayer.position);
}
