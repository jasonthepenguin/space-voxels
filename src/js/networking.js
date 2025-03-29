import { io } from 'socket.io-client';


const MAX_PLAYERS = 50;
let serverFull = false;

import {
    addOrUpdateRemotePlayer,
    removeRemotePlayer,
    respawnRemotePlayer,
    respawnLocalPlayer
} from './remotePlayers.js';

import { respawnAllCelestialBodies } from './celestialBodies.js';

let scene; // scene reference
let player = null; // reference to local player
let updateCameraPositionFn = null; // reference to camera position update function

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

export let serverTimeOffset = 0;

export function initNetworking(updatePlayerCount, gameScene) {
    scene = gameScene; // Store the scene reference

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
                addOrUpdateRemotePlayer(scene, id, {
                    ...state.players[id],
                    shipType: state.players[id].shipType || 'default'
                });
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

    socket.on('respawnPlanets', () => {
        respawnAllCelestialBodies(scene);
        console.log('Received planet respawn event from server.');
    });


    socket.on('serverFull', (data) => {
        serverFull = true;
        alert(data.message || "Server is full.");
        socket.disconnect();

        if (window.uiManager) {
            window.uiManager.showServerFullError();
        }
    });
    
    // Updated event handler for player hit using imported functions
    socket.on('playerHit', (data) => {
        console.log(`Received playerHit event for: ${data.targetId}, our ID: ${socket.id}`);
        if (data.targetId === socket.id && player) {
            // We were hit, respawn our local player
            console.log("We were hit! Respawning local player...");
            respawnLocalPlayer(player, scene, updateCameraPositionFn, socket, true);
        } else if (data.targetId !== socket.id) {
            // Another player was hit, respawn them
            console.log(`Remote player ${data.targetId} was hit, respawning them`);
            respawnRemotePlayer(data.targetId, data.position, scene);
        }
    });

    // Add a heartbeat mechanism to verify connectivity
    setInterval(() => {
        if (socket && socket.connected) {
            console.log("Socket connection is active");
        } else {
            console.warn("Socket connection is not active!");
        }
    }, 5000);

    return { socket, playerId: socket.id, isConnected: true };
}

// Function to update the player reference when it's created
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