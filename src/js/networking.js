import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

export let serverTimeOffset = 0;

export function initNetworking(updatePlayerCount) {
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
                window.addOrUpdateRemotePlayer(id, state.players[id]);
            }
        }
    });
    
    socket.on('playerJoined', (data) => {
        window.addOrUpdateRemotePlayer(data.id, data);
    });
    
    socket.on('playerMoved', (data) => {
        window.addOrUpdateRemotePlayer(data.id, data);
    });
    
    socket.on('playerLeft', (data) => {
        window.removeRemotePlayer(data.id);
    });

    socket.on('serverTime', (data) => {
        serverTimeOffset = Date.now() - data.timestamp;
        console.log("Server time synchronized. Offset:", serverTimeOffset, "ms");
    });

    socket.on('respawnPlanets', () => {
        window.respawnPlanets();
        console.log('Received planet respawn event from server.');
    });

    return { socket, playerId: socket.id, isConnected: true };
}

export function sendPlayerReady(socket, isConnected) {
    if (isConnected) socket.emit('playerReady');
}

export function sendPlayerNotReady(socket, isConnected) {
    if (isConnected) socket.emit('playerNotReady');
}

export function updatePlayerCountUI(count) {
    const elem = document.getElementById('players-counter');
    if (elem) elem.textContent = `Players Online: ${count}`;
}