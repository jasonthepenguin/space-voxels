import { io } from 'socket.io-client';
import { audioSystem } from './weapons.js';

const MAX_PLAYERS = 50;
let serverFull = false;

import {
    addOrUpdateRemotePlayer,
    removeRemotePlayer,
    hideRemotePlayerTemporarily,
    showAndRespawnRemotePlayer,
    respawnLocalPlayer
} from './remotePlayers.js';

let scene; // scene reference
let player = null; // reference to local player
let playerIsDead = false; // Track player death state
let updateCameraPositionFn = null; // reference to camera position update function
let sunRef = null;      // *** NEW: Reference to sun ***
let planetsRef = null;  // *** NEW: Reference to planets array ***
let killCount = 0;      // Track local player's kill count
let playerAliveTime = 0; // Track player's alive time in seconds
let aliveStartTime = 0;  // Track when player spawned/started
let aliveTimerInterval = null; // Timer interval reference

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

export let serverTimeOffset = 0;

// Store the initial position received from the server
let initialPlayerPosition = null;

export function initNetworking(updatePlayerCount, gameScene, sun, planets) {
    scene = gameScene; // Store the scene reference
    sunRef = sun;         // Store sun reference
    planetsRef = planets; // Store planets reference

    const socket = io(SOCKET_SERVER_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        timeout: 10000
    });

    socket.on('connect', () => {
        console.log('Connected to server:', socket.id);
    });

    socket.on('playerCount', (data) => {
        updatePlayerCount(data.count);
    });

    socket.on('roomState', (state) => {
        for (const id in state.players) {
            if (id !== socket.id) {
                addOrUpdateRemotePlayer(scene, id, state.players[id]);
            }
        }
    });
    
    socket.on('playerJoined', (data) => {
        addOrUpdateRemotePlayer(scene, data.id, data);
    });
    
    socket.on('playerMoved', (data) => {
        addOrUpdateRemotePlayer(scene, data.id, data);
    });
    
    socket.on('playerLeft', (data) => {
        removeRemotePlayer(scene, data.id);
    });

    socket.on('serverTime', (data) => {
        serverTimeOffset = Date.now() - data.timestamp;
        console.log("Server time synchronized. Offset:", serverTimeOffset, "ms");
    });

    socket.on('serverFull', (data) => {
        serverFull = true;
        alert(data.message || "Server is full.");
        socket.disconnect();

        if (window.uiManager) {
            window.uiManager.showServerFullError();
        }
    });
    
    socket.on('playerHit', (data) => {
        console.log(`Received playerHit event for: ${data.targetId}, our ID: ${socket.id}`);
        if (data.targetId === socket.id) {
            console.log("Server confirmed we were hit!");
        } else {
            console.log(`Remote player ${data.targetId} was hit (server confirmed), hiding them.`);
            hideRemotePlayerTemporarily(data.targetId);
        }
    });

    socket.on('playerDied', (data) => {
        console.log("Received playerDied event from server. Showing death screen.");
        playerIsDead = true;
        
        // Stop the alive timer
        stopAliveTimer();
        
        // Update death screen with final kill count and alive time
        const finalKills = data ? data.finalKills || killCount : killCount;
        const aliveTimeString = formatTime(playerAliveTime);
        
        if (window.uiManager) {
            window.uiManager.showDeathScreen(finalKills, aliveTimeString);
        }
        if (player) {
            player.visible = false;
        }
        if (audioSystem && audioSystem.isAudioInitialized) {
            audioSystem.playSound('game_over', { volume: 0.8 });
        }
    });

    socket.on('killConfirmed', (data) => {
        console.log(`Kill confirmed by server! Victim: ${data.victimId}, Points: ${data.points}, Kills: ${data.kills}`);
        
        // Update local kill count
        killCount = data.kills || (killCount + 1);
        
        // Update UI with new kill count
        updateKillCountUI(killCount);
        
        if (window.uiManager) {
            window.uiManager.showEliminationMessage(data.points || 100);
        }
        if (audioSystem && audioSystem.isAudioInitialized) {
            audioSystem.playSound('holy_shit', { volume: 0.9 });
        }
    });

    socket.on('localPlayerRespawn', (data) => { 
        console.log("Received localPlayerRespawn event with position:", data.position);
        if (player && playerIsDead) {
            // Reset kill count on respawn
            killCount = 0;
            updateKillCountUI(0);
            
            // Restart the alive timer
            startAliveTimer();
            
            respawnLocalPlayer(player, scene, updateCameraPositionFn, data.position, true); 
            playerIsDead = false;
            if (window.uiManager) {
                window.uiManager.hideDeathScreen();
            }
        } else {
            console.log("Respawn requested but player is not dead or doesn't exist.");
        }
    });

    socket.on('playerRespawned', (data) => {
        console.log(`Received playerRespawned event for ID: ${data.id}`);
        if (data.id === socket.id) {
            if (player && playerIsDead) {
                 console.log("Received respawn confirmation for local player, ensuring visibility and state.");
                 player.visible = true; 
                 playerIsDead = false;
                 if (window.uiManager) {
                    window.uiManager.hideDeathScreen();
                 }
            } else if (player) {
                 player.visible = true;
                 playerIsDead = false;
            }
        } else {
            console.log(`Remote player ${data.id} respawned at`, data.position);
            showAndRespawnRemotePlayer(data.id, data, scene);
        }
    });

    socket.on('initialState', (data) => {
        console.log("Received initial state:", data);
        if (data.position) {
            initialPlayerPosition = data.position;
        }
    });

    setInterval(() => {
        if (socket && socket.connected) {
        } else {
            console.warn("Socket connection is not active!");
        }
    }, 5000);

    return { socket, playerId: socket.id, isConnected: true };
}

export function getInitialPlayerPosition() {
    return initialPlayerPosition;
}

export function setPlayerReference(playerRef, cameraUpdateFn) {
    player = playerRef;
    updateCameraPositionFn = cameraUpdateFn;
}

export function sendPlayerReady(socket, isConnected, shipType = 'default') {
    if (isConnected) socket.emit('playerReady', { shipType });
}

export function sendPlayerNotReady(socket, isConnected) {
    if (isConnected) socket.emit('playerNotReady');
}

export function updatePlayerCountUI(count) {
    const elem = document.getElementById('players-counter');
    if (elem) elem.textContent = `Players Online: ${count}/${MAX_PLAYERS}`;
}

export function requestRespawn(socket, isConnected) {
    if (isConnected && playerIsDead) {
        console.log("Requesting respawn from server...");
        socket.emit('requestRespawn');
    } else {
        console.log("Cannot request respawn: Not connected or not dead.");
    }
}

export function isPlayerDead() {
    return playerIsDead;
}

export function setPlayerDeadState(isDead) {
    playerIsDead = isDead;
    if (player) {
        player.visible = !isDead;
    }
    if (isDead && window.uiManager) {
        window.uiManager.showDeathScreen();
    } else if (!isDead && window.uiManager) {
        window.uiManager.hideDeathScreen();
    }
}

export function updateKillCountUI(count) {
    const elem = document.getElementById('kills-counter');
    if (elem) elem.textContent = `Kills: ${count}`;
    
    // Also update kills on death screen if visible
    const deathKillsElem = document.getElementById('death-kills');
    if (deathKillsElem) deathKillsElem.textContent = count.toString();
}

export function getKillCount() {
    return killCount;
}

// Used for respawn to reset kill count
export function resetKillCount() {
    killCount = 0;
    updateKillCountUI(0);
}

// Add this function to start tracking alive time
export function startAliveTimer() {
    // Reset timer values
    playerAliveTime = 0;
    aliveStartTime = Date.now();
    
    // Clear any existing interval
    if (aliveTimerInterval) clearInterval(aliveTimerInterval);
    
    // Update every second
    aliveTimerInterval = setInterval(() => {
        playerAliveTime = Math.floor((Date.now() - aliveStartTime) / 1000);
        updateAliveTimeUI(formatTime(playerAliveTime));
    }, 1000);
}

// Add this function to stop the timer
export function stopAliveTimer() {
    if (aliveTimerInterval) {
        clearInterval(aliveTimerInterval);
        aliveTimerInterval = null;
    }
}

// Format seconds into MM:SS
export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Update the UI with the current alive time
export function updateAliveTimeUI(timeString) {
    const elem = document.getElementById('alive-timer');
    if (elem) elem.textContent = `Alive: ${timeString}`;
}

// Get the current alive time (formatted)
export function getAliveTime() {
    return formatTime(playerAliveTime);
}