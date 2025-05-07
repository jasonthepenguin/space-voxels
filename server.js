const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const THREE = require('three');

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);

// MAX players
const MAX_PLAYERS = 50;

// Rate Limiting variables
const chatCooldowns = new Map(); // socket.id => timestamp
const CHAT_COOLDOWN_MS = 1000;   // 1 message per second
const POSITION_COOLDOWN_MS = 50;

const laserTimestamps = new Map(); // socket.id => timestamp
const LASER_COOLDOWN_MS = 300; // Match client side laser cooldown

const positionTimestamps = new Map(); // socket.id => timestamp

// New rate limiting for respawn and voxel destruction
const respawnTimestamps = new Map(); // socket.id => timestamp
const RESPAWN_COOLDOWN_MS = 3000; // 3 seconds between respawns

const voxelDestructionTimestamps = new Map(); // socket.id => timestamp
const VOXEL_DESTRUCTION_COOLDOWN_MS = 100; // 100ms between voxel destructions

// --- Input Validation Constants ---
// Max squared distance player can move per tick (3 units at 50ms interval => 60 units/s, client max is 45 units/s)
const MAX_DISTANCE_PER_TICK_SQ = 9;
const WORLD_BOUNDS = {
  minX: -240, maxX: 240, // Matched client boundary
  minY: -240, maxY: 240, // Matched client boundary
  minZ: -240, maxZ: 240  // Matched client boundary
};
const LASER_POSITION_TOLERANCE_SQ = 100; // Max squared distance laser origin can differ from server position (5 units)
const PLAYER_HITBOX_RADIUS = 2.5; // Adjust as needed - size of player for collision
const PLAYER_HITBOX_RADIUS_SQ = PLAYER_HITBOX_RADIUS * PLAYER_HITBOX_RADIUS;
// --- End Input Validation Constants ---

const VALID_SHIP_TYPES = ['Flowers Ship', 'Angel Ship', 'Chris Ship', 'default'];

const ipConnectionCounts = new Map();
const MAX_CONNECTIONS_PER_IP = 2;

// Setup CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3001',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Basic route for checking if server is running
app.get('/', (req, res) => {
  res.send('Space Voxels multiplayer server is running!');
});

// NEW: Admin route to list players
app.get('/admin/players', (req, res) => {
  const { adminPassword } = req.query;

  if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not set in environment variables.');
    return res.status(500).send('Admin functionality not configured.');
  }

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).send('Unauthorized: Invalid admin password.');
  }

  const playerList = Object.entries(gameState.players).map(([id, player]) => ({
    id: id,
    username: player.username || `Player_${id.substring(0, 5)}`, // Fallback if username somehow not set
    // You could add other info here if needed, e.g., player.kills
  }));

  res.status(200).json(playerList);
  console.log(`Admin listed players. Count: ${playerList.length}`);
});

// NEW: Admin route to kick a player by username
app.get('/admin/kick', (req, res) => {
  const { usernameToKick, adminPassword } = req.query;

  if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not set in environment variables.');
    return res.status(500).send('Admin functionality not configured.');
  }

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).send('Unauthorized: Invalid admin password.');
  }

  if (!usernameToKick) {
    return res.status(400).send('Bad Request: usernameToKick query parameter is required.');
  }

  let playerIdToKick = null;
  let foundPlayer = false;

  // Find the player by username in the gameState
  for (const [id, player] of Object.entries(gameState.players)) {
    if (player.username === usernameToKick) {
      playerIdToKick = id;
      foundPlayer = true;
      break;
    }
  }

  if (!foundPlayer) {
    return res.status(404).send(`Player with username '${usernameToKick}' not found.`);
  }

  const targetSocket = io.sockets.sockets.get(playerIdToKick);

  if (targetSocket) {
    targetSocket.emit('kicked', { reason: 'Kicked by administrator.' });
    targetSocket.disconnect(true); // true ensures 'disconnect' event fires for cleanup
    console.log(`Admin kicked player: ${usernameToKick} (ID: ${playerIdToKick})`);
    res.status(200).send(`Player ${usernameToKick} (ID: ${playerIdToKick}) kicked successfully.`);
  } else {
    // This case should be rare if player is in gameState but socket is missing
    // Manually clean up gameState if socket is somehow already gone
    if (gameState.players[playerIdToKick]) {
        delete gameState.players[playerIdToKick];
        // Potentially call removePlayerHitSphere and broadcastPlayerCount if necessary,
        // though socket.disconnect() should handle this via its 'disconnect' event.
        console.warn(`Player ${usernameToKick} (ID: ${playerIdToKick}) was in gameState but socket was missing. Cleaned up from gameState.`);
         res.status(200).send(`Player ${usernameToKick} (ID: ${playerIdToKick}) found in state and removed, but socket was already disconnected.`);
    } else {
        res.status(500).send(`Error: Player ${usernameToKick} (ID: ${playerIdToKick}) found but their socket was not active.`);
    }
  }
});

// Initialize Socket.io with CORS settings
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 5000,   // Send ping every 5s
  pingTimeout: 10000    // Disconnect if no pong within 10s
});

// Single global room
const GLOBAL_ROOM = 'global';

// Game state storage (Global)
const gameState = {
  players: {},
  destroyedVoxels: new Map() // Use Map<string, Set<number>> for bodyId -> instanceIds
};
const pendingPlayers = {}; // { socket.id: { position: {x,y,z} } }

// *** MOVED HERE: Server-Side Player Hitbox Cache (Global) ***
const playerHitSpheres = {}; // { playerId: THREE.Sphere }

// *** MOVED HERE: Global helper functions for hitbox cache ***
function updatePlayerHitSphere(playerId) {
  const player = gameState.players[playerId]; // Access global gameState
  if (player && player.position) {
     if (!playerHitSpheres[playerId]) { // Access global playerHitSpheres
       playerHitSpheres[playerId] = new THREE.Sphere();
     }
     playerHitSpheres[playerId].center.set(player.position.x, player.position.y, player.position.z);
     playerHitSpheres[playerId].radius = PLAYER_HITBOX_RADIUS;
  } else {
     delete playerHitSpheres[playerId]; // Remove from global cache
  }
}

function removePlayerHitSphere(playerId) {
  delete playerHitSpheres[playerId]; // Remove from global cache
}
// *** END MOVED SECTION ***

// Helper function to get player count (counts fully joined players)
function getPlayerCount() {
  return Object.keys(gameState.players).length;
}

// Validate player username
function isValidUsername(username)
{
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  const maxLength = 10;
  const minLength = 1;
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  return (
    trimmed.length >= minLength &&
    trimmed.length <= maxLength &&
    usernameRegex.test(trimmed)
  );
}

// Helper function to broadcast player count to all players
function broadcastPlayerCount() {
  const count = getPlayerCount();
  io.to(GLOBAL_ROOM).emit('playerCount', { count });
  console.log(`Broadcasting player count: ${count}`);
}

// Helper function to validate a Vector3-like object
function isValidVector3(vec) {
  return vec && typeof vec.x === 'number' && !isNaN(vec.x) && isFinite(vec.x) &&
         typeof vec.y === 'number' && !isNaN(vec.y) && isFinite(vec.y) &&
         typeof vec.z === 'number' && !isNaN(vec.z) && isFinite(vec.z);
}

// Helper function to calculate squared distance between two Vector3-like objects
function distanceSquared(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return dx * dx + dy * dy + dz * dz;
}

// *** NEW: Helper to serialize destroyedVoxels map for JSON ***
function serializeDestroyedVoxels(map) {
    const obj = {};
    for (const [key, value] of map.entries()) {
        obj[key] = Array.from(value); // Convert Set to Array
    }
    return obj;
}

// *** NEW: Leaderboard Update Function ***
function broadcastLeaderboard() {
  if (getPlayerCount() === 0 && Object.keys(pendingPlayers).length === 0) { // Also check pending to avoid spamming when server is empty
     // console.log('Skipping leaderboard broadcast, no players connected or pending.'); // Optional: reduce noise
     return;
  }
  
  // Convert players object to array with id, username, and kills
  const leaderboardData = Object.entries(gameState.players)
    .map(([id, player]) => ({
      id,
      username: player.username || `Player_${id.substring(0, 5)}`, // Use username if set, otherwise generate one
      kills: player.kills || 0
    }))
    .sort((a, b) => b.kills - a.kills); // Sort by kills (descending)
  
  // Broadcast the leaderboard to all players (or all connected sockets if no one is in GLOBAL_ROOM yet)
  // If GLOBAL_ROOM is empty but there are pending players, they might still want to see this.
  // However, usually leaderboard makes sense for players *in game*. Let's stick to GLOBAL_ROOM.
  if (io.sockets.adapter.rooms.get(GLOBAL_ROOM) && io.sockets.adapter.rooms.get(GLOBAL_ROOM).size > 0) {
      io.to(GLOBAL_ROOM).emit('leaderboardUpdate', leaderboardData);
      console.log('Broadcasting leaderboard update with', leaderboardData.length, 'players');
  } else if (leaderboardData.length > 0) { // If there's data but no one in room (e.g. last player just left)
      console.log('Leaderboard data exists but no players in GLOBAL_ROOM to send to.');
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {

  // --- IP Connection Limiting ---
  const ip = socket.handshake.address;
  const count = ipConnectionCounts.get(ip) || 0;
  if (count >= MAX_CONNECTIONS_PER_IP) {
    console.log(`Rejecting connection from ${ip}: IP limit reached (${count + 1}/${MAX_CONNECTIONS_PER_IP})`);
    socket.emit('ipLimitWarning', { 
      message: `You have reached the maximum of ${MAX_CONNECTIONS_PER_IP} connections from your IP address. Please close other tabs or devices to continue playing.` 
    });
    socket.disconnect(true);
    return;
  }
  ipConnectionCounts.set(ip, count + 1);
  // --- End IP Connection Limiting ---

  // Initial check if server is full of *active* players
  if(getPlayerCount() >= MAX_PLAYERS)
  {
    console.log(`Rejecting connection from ${socket.id}: server full (${getPlayerCount()}/${MAX_PLAYERS})`);
    socket.emit('serverFull', { message: 'Server is full. Please try again later.' });
    ipConnectionCounts.set(ip, Math.max(0, count)); // Decrement if we reject them here
    if (ipConnectionCounts.get(ip) === 0) ipConnectionCounts.delete(ip);
    socket.disconnect(true);
    return;
  }

  console.log(`User connected (pending): ${socket.id} from IP: ${ip}`);
  
  const initialPlayerPosition = {
    x: Math.random() * 150 - 75, // Same range as respawn for consistency
    y: Math.random() * 50 + 10,
    z: Math.random() * 150 - 75
  };
  pendingPlayers[socket.id] = { position: initialPlayerPosition };
  
  // Send the initial state (including random position) back to the connecting client
  socket.emit('initialState', { 
    playerId: socket.id, 
    position: initialPlayerPosition 
  });
  
  socket.emit('serverTime', { timestamp: Date.now() });

  // Player is not yet in the game, so don't send roomState or broadcast player count here.
  
  // Handle player ready state
  socket.on('playerReady', (data) => {
    try {
      if (gameState.players[socket.id]) {
          console.warn(`Player ${socket.id} sent playerReady but already exists in gameState.`);
          return; // Already processed
      }

      // Final check if server became full while client was on username/ship screen
      if (getPlayerCount() >= MAX_PLAYERS) {
          console.log(`Rejecting playerReady from ${socket.id}: server became full while pending.`);
          socket.emit('serverFull', { message: 'Sorry, the server filled up while you were choosing your ship!' });
          // No need to disconnect here, they can try again or will be disconnected if they close client
          // delete pendingPlayers[socket.id]; // removed by disconnect handler
          return;
      }
      
      const pendingPlayerData = pendingPlayers[socket.id];
      if (!pendingPlayerData) {
        console.warn(`Player ${socket.id} sent playerReady but no pendingData found (already processed or disconnected?). Disconnecting.`);
        socket.disconnect(true);
        return;
      }

      socket.join(GLOBAL_ROOM); // Join the global room NOW

      gameState.players[socket.id] = {
        id: socket.id,
        position: pendingPlayerData.position, // Use stored initial position
        rotation: { x: 0, y: 0, z: 0 },
        isReady: true, // Player is ready by sending this event
        shipType: 'default', // Default, will be overridden
        isDead: false,
        kills: 0, // Add kill counter initialized to 0
        username: '' // Default, will be overridden
      };
      delete pendingPlayers[socket.id]; // Clean up from pending store

      // Validate and assign shipType
      const requestedShipType = data?.shipType;
      if (requestedShipType && VALID_SHIP_TYPES.includes(requestedShipType)) {
        gameState.players[socket.id].shipType = requestedShipType;
      } else {
        gameState.players[socket.id].shipType = 'default';
        if (requestedShipType) {
          console.warn(`Player ${socket.id} requested invalid shipType "${requestedShipType}", using default.`);
        }
      }
      
      // Store username if provided
      if (data?.username && isValidUsername(data.username)) {
        gameState.players[socket.id].username = data.username;
        console.log(`Player ${socket.id} username set to ${data.username}`);
      } else {
        // Fallback if username becomes invalid or is missing, though client UI should prevent this
        const fallbackUsername = `Player_${socket.id.substring(0,5)}`;
        gameState.players[socket.id].username = fallbackUsername;
        console.warn(`Player ${socket.id} provided invalid or no username, using fallback: ${fallbackUsername}`);
      }

      // Update hitbox cache when player becomes ready
      updatePlayerHitSphere(socket.id);

      // Send existing players who are ready AND the current destroyed voxel state TO THIS PLAYER
      socket.emit('roomState', {
        players: Object.fromEntries(
          Object.entries(gameState.players)
            .filter(([pid, p]) => p.isReady && !p.isDead && pid !== socket.id)
        ),
        destroyedVoxels: serializeDestroyedVoxels(gameState.destroyedVoxels)
      });

      // Now broadcast the new player to others
      socket.to(GLOBAL_ROOM).emit('playerJoined', {
        id: socket.id,
        position: gameState.players[socket.id].position,
        rotation: gameState.players[socket.id].rotation,
        shipType: gameState.players[socket.id].shipType,
        username: gameState.players[socket.id].username
      });

      console.log(`Player ${socket.id} is ready with ship type: ${gameState.players[socket.id].shipType} and joined global room.`);
      
      // Update and broadcast player count (now that they are fully in)
      broadcastPlayerCount();
      // Update the leaderboard
      broadcastLeaderboard();
      
    } catch (error) {
      console.error(`Error in playerReady: ${error.message}`, error.stack);
       // Attempt to clean up if something went wrong during playerReady
      if (pendingPlayers[socket.id]) delete pendingPlayers[socket.id];
      if (gameState.players[socket.id]) {
          removePlayerHitSphere(socket.id);
          delete gameState.players[socket.id];
          broadcastPlayerCount(); // Adjust count if they were briefly added
          broadcastLeaderboard();
      }
      socket.leave(GLOBAL_ROOM); // Ensure they are not in the room
      // Optionally disconnect the client if the error is severe
      // socket.disconnect(true); 
    }
  });

  // Handle respawn requests
  socket.on('requestRespawn', () => {
    try {
      const playerId = socket.id;
      console.log(`Received requestRespawn from ${playerId}`);

      // Apply rate limiting
      const now = Date.now();
      const lastRespawn = respawnTimestamps.get(playerId) || 0;
      if (now - lastRespawn < RESPAWN_COOLDOWN_MS) {
        console.log(`Respawn rate limit hit for ${playerId}, ignoring request`);
        return; // Ignore the request
      }
      respawnTimestamps.set(playerId, now);

      // Validate player exists and is actually dead
      if (gameState.players[playerId] && gameState.players[playerId].isDead) {
        
        // Generate a random respawn position (customize this logic as needed)
        const respawnPosition = {
          x: Math.random() * 150 - 75, // Wider respawn range
          y: Math.random() * 50 + 10,
          z: Math.random() * 150 - 75
        };
        const respawnRotation = { x: 0, y: 0, z: 0 }; // Reset rotation

        // Update player state on server
        gameState.players[playerId].isDead = false;
        gameState.players[playerId].position = respawnPosition;
        gameState.players[playerId].rotation = respawnRotation;
        gameState.players[playerId].kills = 0; // Reset kill count on respawn
        
        updatePlayerHitSphere(playerId); // Re-add hitbox

        // Broadcast updated leaderboard after kill count reset
        broadcastLeaderboard();

        // Send respawn confirmation and position ONLY to the requesting player
        socket.emit('localPlayerRespawn', { 
          position: respawnPosition,
          kills: 0 // Send reset kill count
        });
        console.log(`Sent localPlayerRespawn to ${playerId} at`, respawnPosition);

        // Notify other players that this player has respawned/moved
        socket.to(GLOBAL_ROOM).emit('playerRespawned', {
          id: playerId,
          position: respawnPosition,
          shipType: gameState.players[playerId].shipType,
          username: gameState.players[playerId].username
        });
        console.log(`Broadcasted respawn/move for ${playerId} to others.`);

      } else {
        console.log(`Invalid respawn request from ${playerId} (not found or not dead).`);
      }
    } catch (error) {
      console.error(`Error in requestRespawn handler: ${error.message}`, error.stack);
    }
  });
  
  // Handle player not ready state (e.g., returning to main menu from game)
  socket.on('playerNotReady', () => {
    try {
      if (gameState.players[socket.id]) {
        gameState.players[socket.id].isReady = false; // Mark as not ready
        // removePlayerHitSphere(socket.id); // Keep them in game state, but they shouldn't be targetable
                                          // Server-side hit detection should check for isReady.

        // Notify others the player left readiness (they will hide them)
        socket.to(GLOBAL_ROOM).emit('playerLeft', { id: socket.id }); 
        console.log(`Player ${socket.id} is not ready (e.g. returned to menu)`);
        
        // Player count reflects "connected and chose username", so it doesn't change here.
        // Leaderboard will still include them if they had score, until they disconnect.
      }
    } catch (error) {
      console.error(`Error in playerNotReady: ${error.message}`);
    }
  });
  
  // Handle player position updates
  socket.on('updatePosition', (data) => {
    const player = gameState.players[socket.id];
    // Only process if player is in gameState (i.e., after playerReady)
    if (!player) {
        // console.warn(`Received updatePosition from ${socket.id} but player not in gameState.`);
        return;
    }
    const now = Date.now();
    const lastUpdate = positionTimestamps.get(socket.id) || now; // Use now for first update
    const timeDelta = now - lastUpdate;

    // 1. Rate Limiting (already exists)
    if (timeDelta < POSITION_COOLDOWN_MS && lastUpdate !== now) { // Allow first update immediately
      // console.warn(`Position update rate limit hit for ${socket.id}`); // Optional: Reduce noise
      return;
    }
    positionTimestamps.set(socket.id, now);

    // 2. Basic Data Validation
    if (!data || !isValidVector3(data.position) || !isValidVector3(data.rotation)) {
      console.warn(`Invalid position/rotation data received from ${socket.id}`);
      return;
    }

    // 3. World Boundary Check
    const { x, y, z } = data.position;
    if (x < WORLD_BOUNDS.minX || x > WORLD_BOUNDS.maxX ||
        y < WORLD_BOUNDS.minY || y > WORLD_BOUNDS.maxY ||
        z < WORLD_BOUNDS.minZ || z > WORLD_BOUNDS.maxZ) {
      console.warn(`Player ${socket.id} sent out-of-bounds position:`, data.position);
      // Optional: Teleport player back in bounds or disconnect
      return; // For now, just ignore the update
    }

    if (player) {
        // 4. Speed/Teleport Check (only if not the first update)
        if (lastUpdate !== now && player.position) {
          const distSq = distanceSquared(player.position, data.position);
          // Allow slightly more distance based on actual time delta, capped by max speed logic
          const maxDistSqForDelta = MAX_DISTANCE_PER_TICK_SQ * Math.pow(timeDelta / POSITION_COOLDOWN_MS, 2);
          // Add a small buffer for timing inconsistencies
          const allowedDistSq = Math.max(MAX_DISTANCE_PER_TICK_SQ, maxDistSqForDelta) * 1.1; 

          if (distSq > allowedDistSq) {
             console.warn(`Player ${socket.id} moved too far! DistSq: ${distSq.toFixed(2)}, AllowedSq: ${allowedDistSq.toFixed(2)}, Delta: ${timeDelta}ms`);
             // Optional: Snap back to last valid position or disconnect
             return; // Ignore the update
          }
        }

        // --- Update Server State ---
        player.position = data.position;
        player.rotation = data.rotation;

        // Update hitbox cache on position update (using the GLOBAL function)
        if (player.isReady && !player.isDead) { // Only update hitbox if active
             updatePlayerHitSphere(socket.id);
        }

        // --- Broadcast Valid Movement ---
        if (player.isReady && !player.isDead ) { // only broadcast position if player ready and NOT dead
          socket.to(GLOBAL_ROOM).volatile.emit('playerMoved', {
              id: socket.id,
              position: data.position,
              rotation: data.rotation,
              username: player.username // Include username in position updates
          });
        }
    }
  });
  
  // Handle voxel destruction - REVISED
  socket.on('destroyVoxel', (data) => {
    const player = gameState.players[socket.id];
    if (!player) return; // Ignore if player not fully in game
    try {
      // Apply rate limiting
      const now = Date.now();
      const lastDestruction = voxelDestructionTimestamps.get(socket.id) || 0;
      if (now - lastDestruction < VOXEL_DESTRUCTION_COOLDOWN_MS) {
        // console.log(`Voxel destruction rate limit hit for ${socket.id}`); // Uncomment for debugging
        return; // Ignore the request
      }
      voxelDestructionTimestamps.set(socket.id, now);

      // Basic Validation
      if (!data || typeof data.bodyId !== 'string' || typeof data.instanceId !== 'number' || data.instanceId < 0 || !Number.isInteger(data.instanceId)) {
        console.warn(`Invalid destroyVoxel data from ${socket.id}:`, data);
        return;
      }

      const { bodyId, instanceId } = data;

      // Player State Check
      if (!player || !player.isReady || player.isDead) {
        console.log(`Ignoring destroyVoxel from invalid player state: ${socket.id}`);
        return; // Ignore if player isn't in a state to destroy
      }

      // Check if already destroyed
      const bodySet = gameState.destroyedVoxels.get(bodyId);
      if (bodySet && bodySet.has(instanceId)) {
        // console.log(`Voxel ${instanceId} on ${bodyId} already destroyed, ignoring.`);
        return; // Already destroyed
      }

      // Update server state
      if (!bodySet) {
        gameState.destroyedVoxels.set(bodyId, new Set([instanceId]));
      } else {
        bodySet.add(instanceId);
      }

      // Broadcast to all players in the room (including sender for consistency)
      io.to(GLOBAL_ROOM).emit('voxelDestroyed', {
        bodyId,
        instanceId,
        destroyedBy: socket.id // Optional: include who destroyed it
      });

      console.log(`Voxel ${instanceId} on ${bodyId} destroyed by ${socket.id}`);

    } catch (error) {
      console.error(`Error in destroyVoxel: ${error.message}`, error.stack);
    }
  });

    // Handle chat messages
  socket.on('chatMessage', (data) => {
    const player = gameState.players[socket.id];
    if (!player || !player.isReady) { // Player must be ready to chat
        // console.log(`Player ${socket.id} tried to chat but is not ready.`);
        return;
    }
    try {

      const now = Date.now();
      const lastTime = chatCooldowns.get(socket.id) || 0;

      if (now - lastTime < CHAT_COOLDOWN_MS)
      {
        console.log(`Rate limit hit for ${socket.id}`);
        return; // ignore message
      }
      chatCooldowns.set(socket.id, now);

      // Validate the chat message
      if (!data.message || typeof data.message !== 'string') {
        console.log(`Invalid chat message format from ${socket.id}`);
        return;
      }

      // Trim and limit message length for safety
      const message = data.message.trim().substring(0, 200);
      
      if (message.length === 0) {
        return; // Don't broadcast empty messages
      }

      // Get username from server's gameState for consistency
      let username = player.username || `Player_${socket.id.substring(0, 5)}`;
      // No need to re-validate username if it's coming from trusted gameState
      
      console.log(`Chat message from ${username}: ${message}`);
      
      // Broadcast the message to all players in the global room
      io.to(GLOBAL_ROOM).emit('chatMessage', {
        username: username,
        message: message,
        timestamp: now,
        senderId: socket.id
      });
      
    } catch (error) {
      console.error(`Error handling chat message: ${error.message}`);
    }
  });

  // Handle Laser Firing - WITH SERVER-SIDE HIT DETECTION
  socket.on('laserFired', (data) => {
    const shooter = gameState.players[socket.id]; // Renamed from 'player'
    const shooterId = socket.id;
    // Only process if shooter is in gameState and ready/not dead
    if (!shooter || !shooter.isReady || shooter.isDead) {
      return;
    }
    try {
      // 1. Rate Limiting
      const now = Date.now();
      const lastFireTime = laserTimestamps.get(socket.id) || 0;
      if (now - lastFireTime < LASER_COOLDOWN_MS) {
        return;
      }
      laserTimestamps.set(socket.id, now);

      // 2. Basic Data Validation
      const startPosVec = data && Array.isArray(data.startPos) && data.startPos.length === 3 ? new THREE.Vector3(data.startPos[0], data.startPos[1], data.startPos[2]) : null;
      const targetPointVec = data && Array.isArray(data.targetPoint) && data.targetPoint.length === 3 ? new THREE.Vector3(data.targetPoint[0], data.targetPoint[1], data.targetPoint[2]) : null;

      if (!startPosVec || !targetPointVec || !isValidVector3(startPosVec) || !isValidVector3(targetPointVec) || typeof data.shipType !== 'string') {
        console.warn(`Invalid laserFired data received from ${socket.id}`);
        return;
      }

      // 3. Player State Check (already did this with 'shooter' variable)
      // const shooter = gameState.players[socket.id]; // MOVED UP
      // const shooterId = socket.id; // MOVED UP
      // if (!shooter || !shooter.isReady || shooter.isDead) { // MOVED UP
      //   return; // Ignore if player isn't in a state to shoot
      // }

      // 4. Laser Origin Position Check
      const distSqFromPlayer = startPosVec.distanceToSquared(shooter.position);
      if (distSqFromPlayer > LASER_POSITION_TOLERANCE_SQ) {
          console.warn(`Player ${shooterId} fired laser from invalid position. DistSq: ${distSqFromPlayer.toFixed(2)}, AllowedSq: ${LASER_POSITION_TOLERANCE_SQ}`);
          return; // Ignore the event
      }

      // 5. Broadcast to others (visual only) - DO THIS FIRST
      socket.to(GLOBAL_ROOM).emit('remoteLaserFired', {
        playerId: shooterId,
        startPos: data.startPos,
        targetPoint: data.targetPoint,
        shipType: data.shipType
      });

      // --- 6. SERVER-SIDE HIT DETECTION ---
      const laserDirection = new THREE.Vector3().subVectors(targetPointVec, startPosVec).normalize();
      const laserRay = new THREE.Ray(startPosVec, laserDirection);
      const maxLaserDist = startPosVec.distanceTo(targetPointVec); // Max distance based on client target

      // *** DEBUG LOGGING START ***
      // console.log(`[HitCheck ${shooterId}] Ray Origin: ${startPosVec.x.toFixed(1)},${startPosVec.y.toFixed(1)},${startPosVec.z.toFixed(1)} Dir: ${laserDirection.x.toFixed(1)},${laserDirection.y.toFixed(1)},${laserDirection.z.toFixed(1)} MaxDist: ${maxLaserDist.toFixed(1)}`);
      // *** DEBUG LOGGING END ***

      let hitPlayerId = null;
      let hitDistance = maxLaserDist + 1; // Initialize hit distance beyond max range

      // Iterate through other active players
      for (const targetPlayerId in gameState.players) {
        if (targetPlayerId === shooterId) continue; // Don't hit self

        const targetPlayer = gameState.players[targetPlayerId];
        const targetSphere = playerHitSpheres[targetPlayerId];

        if (targetPlayer.isReady && !targetPlayer.isDead && targetSphere) {
          // *** DEBUG LOGGING START ***
          // const targetPos = targetSphere.center;
          // console.log(`[HitCheck ${shooterId}] Checking target ${targetPlayerId} at ${targetPos.x.toFixed(1)},${targetPos.y.toFixed(1)},${targetPos.z.toFixed(1)} Radius: ${targetSphere.radius}`);
          // *** DEBUG LOGGING END ***

          const intersectionPoint = new THREE.Vector3();
          const intersects = laserRay.intersectSphere(targetSphere, intersectionPoint);

          if (intersects) {
            const distanceToHit = startPosVec.distanceTo(intersectionPoint);
            // *** DEBUG LOGGING START ***
            // console.log(`[HitCheck ${shooterId}] INTERSECTION with ${targetPlayerId}! Point: ${intersectionPoint.x.toFixed(1)},${intersectionPoint.y.toFixed(1)},${intersectionPoint.z.toFixed(1)} Dist: ${distanceToHit.toFixed(1)}`);
            // *** DEBUG LOGGING END ***

            if (distanceToHit <= maxLaserDist && distanceToHit < hitDistance) {
              // *** DEBUG LOGGING START ***
              // console.log(`[HitCheck ${shooterId}] VALID Hit on ${targetPlayerId}. Old hitDistance: ${hitDistance.toFixed(1)}`);
              // *** DEBUG LOGGING END ***
              hitPlayerId = targetPlayerId;
              hitDistance = distanceToHit; 
            } else {
               // *** DEBUG LOGGING START ***
               // console.log(`[HitCheck ${shooterId}] INVALID Hit on ${targetPlayerId}. distanceToHit (${distanceToHit.toFixed(1)}) vs maxLaserDist (${maxLaserDist.toFixed(1)}), hitDistance (${hitDistance.toFixed(1)})`);
               // *** DEBUG LOGGING END ***
            }
          }
        } else {
            // *** DEBUG LOGGING START ***
            // if (targetPlayerId !== shooterId) { 
            //     console.log(`[HitCheck ${shooterId}] Skipping target ${targetPlayerId}. Ready: ${targetPlayer?.isReady}, Dead: ${targetPlayer?.isDead}, Sphere: ${!!targetSphere}`);
            // }
            // *** DEBUG LOGGING END ***
        }
      }

      // 7. Process Confirmed Hit
      if (hitPlayerId) {
          // *** DEBUG LOGGING START ***
          console.log(`[HitCheck ${shooterId}] FINAL HIT CONFIRMED on ${hitPlayerId}`);
          // *** DEBUG LOGGING END ***

          gameState.players[hitPlayerId].isDead = true;
          removePlayerHitSphere(hitPlayerId); // Remove from checks

          const targetFinalKills = gameState.players[hitPlayerId].kills || 0;
          gameState.players[shooterId].kills = (gameState.players[shooterId].kills || 0) + 1;
          const shooterKills = gameState.players[shooterId].kills;

          const targetSocket = io.sockets.sockets.get(hitPlayerId);
          if (targetSocket) {
              targetSocket.emit('playerDied', { finalKills: targetFinalKills });
              console.log(`Sent 'playerDied' to target ${hitPlayerId}`);
          }

          io.to(GLOBAL_ROOM).emit('playerHit', { targetId: hitPlayerId });
          console.log(`Broadcast 'playerHit' for target ${hitPlayerId}`);

          const shooterSocket = io.sockets.sockets.get(shooterId);
          if (shooterSocket) {
              shooterSocket.emit('killConfirmed', { 
                  victimId: hitPlayerId, 
                  points: 100,
                  kills: shooterKills
              });
              console.log(`Sent 'killConfirmed' to shooter ${shooterId} with kill count: ${shooterKills}`);
          }
          broadcastLeaderboard(); // Update leaderboard after a kill

      } else {
           // *** DEBUG LOGGING START ***
           // console.log(`[HitCheck ${shooterId}] No valid hit registered.`);
           // *** DEBUG LOGGING END ***
      }

    } catch (error) {
      console.error(`Error handling laserFired: ${error.message}`, error.stack);
    }
  });

  
  // Handle disconnection
  socket.on('disconnect', () => {
    const disconnectedId = socket.id;
    console.log(`User disconnected: ${disconnectedId} from IP: ${socket.handshake.address}`);

    // Clean up from pendingPlayers if they disconnect before sending 'playerReady'
    if (pendingPlayers[disconnectedId]) {
        delete pendingPlayers[disconnectedId];
        console.log(`Removed ${disconnectedId} from pendingPlayers on disconnect.`);
    }

    // If player was in the game state, remove them
    if (gameState.players[disconnectedId]) {
        removePlayerHitSphere(disconnectedId); // Remove hitbox cache
        delete gameState.players[disconnectedId];
        io.to(GLOBAL_ROOM).emit('playerLeft', { id: disconnectedId });
        broadcastPlayerCount();
        broadcastLeaderboard(); // Update leaderboard when a player leaves
        console.log(`Removed ${disconnectedId} from gameState on disconnect.`);
    }

    try {
      chatCooldowns.delete(disconnectedId);
      positionTimestamps.delete(disconnectedId);
      laserTimestamps.delete(disconnectedId);
      respawnTimestamps.delete(disconnectedId);
      voxelDestructionTimestamps.delete(disconnectedId);

      // --- IP Connection Limiting Cleanup ---
      const ip = socket.handshake.address;
      if (ip) { // Ensure ip is defined
          const currentCount = ipConnectionCounts.get(ip) || 1;
          if (currentCount <= 1) {
              ipConnectionCounts.delete(ip);
          } else {
              ipConnectionCounts.set(ip, currentCount - 1);
          }
          console.log(`IP connection count for ${ip} is now ${ipConnectionCounts.get(ip) || 0}`);
      }
      // --- End IP Connection Limiting Cleanup ---

    } catch (error) {
      console.error(`Error handling disconnect cleanup for ${disconnectedId}: ${error.message}`);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Broadcast timestamp every 30 seconds to keep players in sync
setInterval(() => {
  // Only broadcast if there are players in the global room or pending
  if ( (io.sockets.adapter.rooms.get(GLOBAL_ROOM) && io.sockets.adapter.rooms.get(GLOBAL_ROOM).size > 0) || Object.keys(pendingPlayers).length > 0 ) {
    // Emit to all connected sockets, not just those in GLOBAL_ROOM,
    // as pending players also need time sync.
    io.emit('serverTime', { timestamp: Date.now() });
    console.log('Broadcasting server time update to all connected sockets.');
    
    // Leaderboard is relevant for players in the game.
    broadcastLeaderboard();
  } else {
    // console.log('Skipping server time update, no players connected or pending.'); // Optional: reduce noise
  }
}, 30000);

// Respawn planets every 30 seconds
setInterval(() => {
  // Only respawn planets if there are players actually in the game (in GLOBAL_ROOM)
  if (io.sockets.adapter.rooms.get(GLOBAL_ROOM) && io.sockets.adapter.rooms.get(GLOBAL_ROOM).size > 0) {
    gameState.destroyedVoxels.clear();
    console.log('Cleared server destroyed voxel state for planet respawn.');

    io.to(GLOBAL_ROOM).emit('respawnPlanets');
    console.log('Broadcasting planet respawn event to GLOBAL_ROOM.');
  } else {
    // console.log('Skipping planet respawn, no players in GLOBAL_ROOM.'); // Optional: reduce noise
  }
}, 30000);