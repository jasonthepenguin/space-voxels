import * as THREE from 'three';
import { createPlayer } from './player.js';


// Remote players collection
const remotePlayers = {};

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
        console.log(`Created remote player: ${id}`);

    } else {
        // Update target positions/rotations for interpolation
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


// Get a specific remote player
export function getRemotePlayer(id) {
    return remotePlayers[id];
}

// Get all remote players
export function getAllRemotePlayers() {
    return remotePlayers;
}

// function to respawn the local player
export function respawnLocalPlayer(player, scene, updateCameraPosition, socket, isConnected) {
    console.log("Respawning local player...");
    
    if (!player) {
        console.error("Cannot respawn: player does not exist");
        return;
    }
    
    // Generate a random respawn position
    const respawnPosition = {
        x: Math.random() * 100 - 50,
        y: Math.random() * 50 + 10,
        z: Math.random() * 100 - 50
    };
    
    // Create a respawn explosion effect
    const explosionGeometry = new THREE.SphereGeometry(2, 16, 16);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(player.position);
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
    
    // Teleport player to new position
    player.position.set(respawnPosition.x, respawnPosition.y, respawnPosition.z);
    
    // Reset rotation
    player.rotation.set(0, 0, 0);
    
    // Update camera position immediately
    updateCameraPosition();
    
    // Notify server of new position
    if (socket && isConnected) {
        socket.volatile.emit('updatePosition', {
            position: {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            },
            rotation: {
                x: player.rotation.x,
                y: player.rotation.y,
                z: player.rotation.z
            }
        });
    }
    
    console.log("Local player respawned at", respawnPosition);
}

// Respawn a remote player
export function respawnRemotePlayer(id, position, scene) {
    const remotePlayer = remotePlayers[id];
    if (!remotePlayer) {
        console.error(`Remote player ${id} not found in remotePlayers object`);
        return;
    }
    
    console.log(`Remote player found, current position:`, remotePlayer.position);
    
    // Create a respawn explosion effect at current position
    const explosionGeometry = new THREE.SphereGeometry(2, 16, 16);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(remotePlayer.position);
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
    
    // Log before teleport
    console.log(`Teleporting player from`, remotePlayer.position, `to`, position);
    
    // Teleport immediately
    remotePlayer.position.set(position.x, position.y, position.z);
    
    // Reset rotation
    remotePlayer.rotation.set(0, 0, 0);
    
    // Update target position for interpolation
    remotePlayer.userData.targetPosition = new THREE.Vector3(position.x, position.y, position.z);
    remotePlayer.userData.targetRotation = new THREE.Euler(0, 0, 0);
    
    // Create a respawn effect at new position
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
    
    console.log(`Teleport complete, new position:`, remotePlayer.position);
}
