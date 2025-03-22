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
