import { io } from 'socket.io-client';

// Backend server URL - will use environment variable in production
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

// Initialize networking
export function initNetworking(updatePlayerCount) {
    let socket;
    let playerId = null;
    let isConnected = false;
    
    console.log(`Connecting to Socket.io server at ${SOCKET_SERVER_URL}`);
    
    // Connect to server with more detailed logging
    try {
        socket = io(SOCKET_SERVER_URL, {
            transports: ['websocket'],
            reconnectionAttempts: 5,
            timeout: 10000
        });
        
        // Connection events with more detailed logging
        socket.on('connect', () => {
            console.log('Connected to server with socket ID:', socket.id);
            isConnected = true;
            playerId = socket.id;
            
            // Server now automatically adds players to the global room
            console.log('Joined global room');
        });
        
        socket.on('disconnect', (reason) => {
            console.log(`Disconnected from server. Reason: ${reason}`);
            isConnected = false;
            updatePlayerCount(1); // Reset to 1 when disconnected
        });
        
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            isConnected = false;
        });
        
        socket.on('connect_timeout', () => {
            console.error('Connection timeout');
            isConnected = false;
        });
        
        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`Attempting to reconnect: attempt ${attemptNumber}`);
        });
        
        socket.on('reconnect_failed', () => {
            console.error('Failed to reconnect after multiple attempts');
        });
        
        // Game-specific events
        socket.on('playerCount', (data) => {
            console.log('Player count update:', data.count);
            updatePlayerCount(data.count);
        });
        
        // Receive room state when connecting
        socket.on('roomState', (state) => {
            console.log('Received room state:', state);
            // We'll implement handling other players later
        });
        
        // Handle player joined events
        socket.on('playerJoined', (data) => {
            console.log('New player joined:', data.id);
            // We'll implement handling other players later
        });
        
        // Handle player left events
        socket.on('playerLeft', (data) => {
            console.log('Player left:', data.id);
            // We'll implement handling other players later
        });
        
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    } catch (error) {
        console.error('Error initializing socket connection:', error);
    }
    
    return { socket, playerId, isConnected };
}

// Send player ready event
export function sendPlayerReady(socket, isConnected) {
    if (socket && isConnected) {
        socket.emit('playerReady');
        console.log('Sent playerReady event');
    }
}

// Send player not ready event
export function sendPlayerNotReady(socket, isConnected) {
    if (socket && isConnected) {
        socket.emit('playerNotReady');
        console.log('Sent playerNotReady event');
    }
}

// Update player count in UI
export function updatePlayerCountUI(count) {
    const playersCounterElement = document.getElementById('players-counter');
    if (playersCounterElement) {
        playersCounterElement.textContent = `Players Online: ${count}`;
    }
} 