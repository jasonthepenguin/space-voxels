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

// NEW: Track leaderboard data
let leaderboardData = [];
let localPlayerUsername = ''; // Store the current player's username

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

export let serverTimeOffset = 0;

// Store the initial position received from the server
let initialPlayerPosition = null;

// Store socket instance for access across functions
let socketInstance = null;

export function initNetworking(updatePlayerCount, gameScene, sun, planets) {
    scene = gameScene; // Store the scene reference
    sunRef = sun;         // Store sun reference
    planetsRef = planets; // Store planets reference

    const socket = io(SOCKET_SERVER_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        timeout: 10000
    });

    // Store socket instance for use in other functions
    socketInstance = socket;

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
        
        // Update leaderboard with initial data
        if (state.players) {
            updateLeaderboardFromPlayerData(state.players, socket.id);
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
        // Update leaderboard when player leaves
        removePlayerFromLeaderboard(data.id);
    });

    // Listen for leaderboard updates from server
    socket.on('leaderboardUpdate', (data) => {
        if (Array.isArray(data)) {
            updateLeaderboard(data, socket.id);
        }
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
        if (data.targetId !== socket.id) {
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
        
        // Update leaderboard with new kill count
        updateLocalPlayerKillsInLeaderboard(killCount);
        
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
            
            // Update leaderboard with reset kill count
            updateLocalPlayerKillsInLeaderboard(0);
            
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

    socket.on('kicked', (data) => {
      alert(`You have been kicked from the server: ${data.reason || 'No reason specified.'}`);
      // Reset UI and potentially reload or go to main menu
      if (window.uiManager && typeof window.uiManager.changeState === 'function' && window.GameState) {
        // Attempt to go to a safe state like USERNAME_INPUT or MAIN_MENU
        // In this case, USERNAME_INPUT might be better to force re-entry.
        window.uiManager.changeState(window.GameState.USERNAME_INPUT);
        if (socket && socket.connected) { // Use the 'socket' variable from the outer scope
            socket.disconnect(true); // Ensure client socket is closed and 'disconnect' fires
        }
      } else {
        // Fallback if UI manager is not available
        if (socket && socket.connected) {
            socket.disconnect(true);
        }
        window.location.reload();
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
    if (isConnected) socket.emit('playerReady', { 
        shipType, 
        username: localPlayerUsername // Include username in the ready message
    });
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

// Set the local player's username for leaderboard display
export function setLocalPlayerUsername(username) {
    localPlayerUsername = username;
}

// Update leaderboard from player data received from server
function updateLeaderboardFromPlayerData(playersData, localPlayerId) {
    // Convert players object to array
    const players = Object.keys(playersData).map(id => ({
        id,
        username: playersData[id].username || `Player_${id.substring(0, 5)}`,
        kills: playersData[id].kills || 0
    }));
    
    // Update the leaderboard with the processed data
    updateLeaderboard(players, localPlayerId);
}

// Remove a player from the leaderboard when they leave
function removePlayerFromLeaderboard(playerId) {
    // Filter out the player who left
    leaderboardData = leaderboardData.filter(player => player.id !== playerId);
    
    // Re-render the leaderboard
    renderLeaderboard(leaderboardData);
}

// Update leaderboard with new data from server
export function updateLeaderboard(players, localPlayerId) {
    // Sort players by kills (descending)
    const sortedPlayers = [...players].sort((a, b) => b.kills - a.kills);
    
    // Take top 10 players
    const topPlayers = sortedPlayers.slice(0, 10);
    
    // Store the updated leaderboard data
    leaderboardData = topPlayers;
    
    // Render the leaderboard UI
    renderLeaderboard(topPlayers, localPlayerId);
}

// Render the leaderboard UI
function renderLeaderboard(players, localPlayerId) {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;
    
    // Clear existing entries
    leaderboardList.innerHTML = '';
    
    // Add each player to the leaderboard
    players.forEach((player, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'leaderboard-item';
        
        // Mark the local player's entry
        if (player.id === localPlayerId) {
            listItem.classList.add('self');
        }
        
        // Create rank span
        const rankSpan = document.createElement('span');
        rankSpan.className = 'leaderboard-rank';
        rankSpan.textContent = `${index + 1}.`;
        
        // Create username span
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'leaderboard-username';
        
        // Use player's username, or fallback to Player_ID format
        let displayName = player.username || `Player_${player.id.substring(0, 5)}`;
        
        // If this is the local player, use the stored username
        if (player.id === localPlayerId && localPlayerUsername) {
            displayName = localPlayerUsername;
        }
        
        usernameSpan.textContent = displayName;
        
        // Create kills span
        const killsSpan = document.createElement('span');
        killsSpan.className = 'leaderboard-kills';
        killsSpan.textContent = player.kills;
        
        // Add all elements to the list item
        listItem.appendChild(rankSpan);
        listItem.appendChild(usernameSpan);
        listItem.appendChild(killsSpan);
        
        // Add the list item to the leaderboard
        leaderboardList.appendChild(listItem);
    });
    
    // If no players, show a message
    if (players.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'leaderboard-item';
        emptyItem.textContent = 'No players yet';
        leaderboardList.appendChild(emptyItem);
    }
}

// Add a way to manually update player's kill count in leaderboard
export function updateLocalPlayerKillsInLeaderboard(kills) {
    // Update our stored killCount
    killCount = kills;
    
    // Make sure we have socketInstance
    if (!socketInstance) {
        console.warn('Cannot update leaderboard: socket not initialized');
        return;
    }
    
    // Find local player in leaderboard
    const localPlayerIndex = leaderboardData.findIndex(player => player.id === socketInstance.id);
    
    if (localPlayerIndex !== -1) {
        // Update kills if player is already in leaderboard
        leaderboardData[localPlayerIndex].kills = kills;
    } else {
        // Add player to leaderboard if not already there
        leaderboardData.push({
            id: socketInstance.id,
            username: localPlayerUsername || `Player_${socketInstance.id.substring(0, 5)}`,
            kills: kills
        });
    }
    
    // Re-sort and update
    updateLeaderboard(leaderboardData, socketInstance.id);
}