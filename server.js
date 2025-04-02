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

// Helper function to get player count
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
  if (getPlayerCount() === 0) return; // Skip if no players
  
  // Convert players object to array with id, username, and kills
  const leaderboardData = Object.entries(gameState.players)
    .map(([id, player]) => ({
      id,
      username: player.username || `Player_${id.substring(0, 5)}`, // Use username if set, otherwise generate one
      kills: player.kills || 0
    }))
    .sort((a, b) => b.kills - a.kills); // Sort by kills (descending)
  
  // Broadcast the leaderboard to all players
  io.to(GLOBAL_ROOM).emit('leaderboardUpdate', leaderboardData);
  
  console.log('Broadcasting leaderboard update with', leaderboardData.length, 'players');
}

// Socket.io connection handling
io.on('connection', (socket) => {

  if(getPlayerCount() >= MAX_PLAYERS)
  {
    console.log(`Rejecting connection: server full (${getPlayerCount()}/${MAX_PLAYERS})`);
    socket.emit('serverFull', { message: 'Server is full. Please try again later.' });
    socket.disconnect(true);
    return;

  }


  console.log(`User connected: ${socket.id}`);
  
  // Automatically join the global room
  socket.join(GLOBAL_ROOM);
  
  // Store player without broadcasting yet
  gameState.players[socket.id] = {
    id: socket.id,
    // Generate random initial position
    position: {
        x: Math.random() * 150 - 75, // Same range as respawn for consistency
        y: Math.random() * 50 + 10,
        z: Math.random() * 150 - 75
    },
    rotation: { x: 0, y: 0, z: 0 },
    isReady: false,
    shipType: 'default',
    isDead: false,
    kills: 0 // Add kill counter initialized to 0
  };
  
  // Send the initial state (including random position) back to the connecting client
  socket.emit('initialState', { 
    playerId: socket.id, 
    position: gameState.players[socket.id].position 
  });
  
  socket.emit('serverTime', { timestamp: Date.now() });

  // Send existing players who are ready AND the current destroyed voxel state
  socket.emit('roomState', {
    players: Object.fromEntries(
      Object.entries(gameState.players)
        .filter(([id, player]) => player.isReady && !player.isDead && id !== socket.id)
    ),
    // *** Send serialized destroyed voxel state ***
    destroyedVoxels: serializeDestroyedVoxels(gameState.destroyedVoxels)
  });
  
  // Update and broadcast player count
  broadcastPlayerCount();
  
  console.log(`Player ${socket.id} joined global room`);
  
  // Handle player ready state
  socket.on('playerReady', (data) => {
    try {
      if (gameState.players[socket.id]) {
        gameState.players[socket.id].isReady = true;

        // Validate and assign shipType
        const requestedShipType = data?.shipType; // Use optional chaining
        if (requestedShipType && VALID_SHIP_TYPES.includes(requestedShipType)) {
          gameState.players[socket.id].shipType = requestedShipType;
        } else {
          gameState.players[socket.id].shipType = 'default'; // Fallback to default
          if (requestedShipType) { // Log if an invalid type was actually provided
            console.warn(`Player ${socket.id} requested invalid shipType "${requestedShipType}", using default.`);
          }
        }
        
        // NEW: Store username if provided
        if (data?.username && isValidUsername(data.username)) {
          gameState.players[socket.id].username = data.username;
          console.log(`Player ${socket.id} username set to ${data.username}`);
        }

        gameState.players[socket.id].isDead = false; // Ensure not dead on ready

        // Update hitbox cache when player becomes ready (using the GLOBAL function)
        updatePlayerHitSphere(socket.id);

        // Now broadcast the player to others for the first time
        socket.to(GLOBAL_ROOM).emit('playerJoined', {
          id: socket.id,
          position: gameState.players[socket.id].position,
          rotation: gameState.players[socket.id].rotation,
          shipType: gameState.players[socket.id].shipType, // Send the validated/default ship type
          username: gameState.players[socket.id].username // Include username in broadcast
        });

        console.log(`Player ${socket.id} is ready with ship type: ${gameState.players[socket.id].shipType}`);
        
        // Update the leaderboard after a player becomes ready
        broadcastLeaderboard();
      }
    } catch (error) {
      console.error(`Error in playerReady: ${error.message}`);
    }
  });

  socket.on('playerDied', (data) => {
    try {
      const killerId = socket.id;
      
      // --- Sanity Checks ---
      // 1. Validate targetId type and existence
      if (!data || typeof data.targetId !== 'string' || data.targetId === '') {
        console.warn(`Invalid targetId received from ${killerId}:`, data);
        return; 
      }
      const targetId = data.targetId;

      // 4. Prevent self-kill reports via this event
      if (killerId === targetId) {
        console.warn(`Player ${killerId} attempted to report self-kill via playerDied event.`);
        return;
      }

      // 2. Validate Killer State
      const killer = gameState.players[killerId];
      if (!killer || !killer.isReady || killer.isDead) {
        console.warn(`Invalid killer state for ${killerId} reporting kill on ${targetId}. Ready: ${killer?.isReady}, Dead: ${killer?.isDead}`);
        return;
      }

      // Get target player state AFTER basic checks
      const target = gameState.players[targetId];

      // 1. (Continued) & 3. Validate Target State (Exists, Ready, Not Already Dead)
      if (!target || !target.isReady || target.isDead) {
        console.log(`Invalid target ${targetId} or target state. Exists: ${!!target}, Ready: ${target?.isReady}, Dead: ${target?.isDead}`);
        return; 
      }
      // --- End Sanity Checks ---

      console.log(`Processing valid playerDied event from ${killerId} targeting ${targetId}`);

      // Mark the target player as dead (passed all checks)
      target.isDead = true;
      
      // Increment killer's kill count
      killer.kills += 1;
      
      // Broadcast updated leaderboard after a kill
      broadcastLeaderboard();

      // Find the target's socket
      const targetSocket = io.sockets.sockets.get(targetId);
      
      if (targetSocket) {
        // Notify ONLY the target player that they died
        targetSocket.emit('playerDied', { finalKills: target.kills }); // Send final kill count
        console.log(`Sent 'playerDied' event to target ${targetId}`);
      } else {
        console.log(`Target player ${targetId} socket not found, but marked as dead.`);
      }

      io.to(GLOBAL_ROOM).emit('playerHit', { targetId: targetId });
      console.log(`Broadcasted 'playerHit' for target ${targetId} to all clients.`);

      // Optional: Broadcast elimination info to everyone (for kill feeds etc.)
      // io.to(GLOBAL_ROOM).emit('playerEliminated', { killerId: killerId, victimId: targetId });

    } catch (error) {
      console.error(`Error in playerDied handler: ${error.message}`, error.stack);
    }
  });

   // NEW: Handle respawn requests
   socket.on('requestRespawn', () => {
    try {
      const playerId = socket.id;
      console.log(`Received requestRespawn from ${playerId}`);

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
        
        // Broadcast updated leaderboard after kill count reset
        broadcastLeaderboard();

        // Send respawn confirmation and position ONLY to the requesting player
        socket.emit('localPlayerRespawn', { 
          position: respawnPosition,
          kills: 0 // Send reset kill count
        });
        console.log(`Sent localPlayerRespawn to ${playerId} at`, respawnPosition);

        // Notify other players that this player has respawned/moved
        // Use 'playerMoved' or create a specific 'playerRespawned' event
        socket.to(GLOBAL_ROOM).emit('playerRespawned', {
          id: playerId,
          position: respawnPosition,
          shipType: gameState.players[playerId].shipType,
          username: gameState.players[playerId].username // Include username in respawn event
          // at the moment rotation is implicity reset to 0,0,0 on client
        });
        console.log(`Broadcasted respawn/move for ${playerId} to others.`);

      } else {
        console.log(`Invalid respawn request from ${playerId} (not found or not dead).`);
      }
    } catch (error) {
      console.error(`Error in requestRespawn handler: ${error.message}`, error.stack);
    }
  });
  
  // Handle player not ready state
  socket.on('playerNotReady', () => {
    try {
      if (gameState.players[socket.id]) {
        gameState.players[socket.id].isReady = false;
        
        // Notify others the player left readiness
        socket.to(GLOBAL_ROOM).emit('playerLeft', { id: socket.id });
        console.log(`Player ${socket.id} is not ready`);
      }
    } catch (error) {
      console.error(`Error in playerNotReady: ${error.message}`);
    }
  });
  
  // Handle player position updates
  socket.on('updatePosition', (data) => {

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


    const player = gameState.players[socket.id];
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
        updatePlayerHitSphere(socket.id);

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
    try {
      // Basic Validation
      if (!data || typeof data.bodyId !== 'string' || typeof data.instanceId !== 'number' || data.instanceId < 0 || !Number.isInteger(data.instanceId)) {
        console.warn(`Invalid destroyVoxel data from ${socket.id}:`, data);
        return;
      }

      const { bodyId, instanceId } = data;
      const player = gameState.players[socket.id];

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

      // Get username from data or use a default with socket ID
      let username = data.username || `Player_${socket.id.substring(0, 5)}`;
      if (!isValidUsername(username)){
        username = `Player_${socket.id.substring(0, 5)}`; // fallback to safe default
      }
      
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

      // 3. Player State Check
      const shooter = gameState.players[socket.id];
      const shooterId = socket.id;
      if (!shooter || !shooter.isReady || shooter.isDead) {
        return; // Ignore if player isn't in a state to shoot
      }

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
      console.log(`[HitCheck ${shooterId}] Ray Origin: ${startPosVec.x.toFixed(1)},${startPosVec.y.toFixed(1)},${startPosVec.z.toFixed(1)} Dir: ${laserDirection.x.toFixed(1)},${laserDirection.y.toFixed(1)},${laserDirection.z.toFixed(1)} MaxDist: ${maxLaserDist.toFixed(1)}`);
      // *** DEBUG LOGGING END ***

      let hitPlayerId = null;
      let hitDistance = maxLaserDist + 1; // Initialize hit distance beyond max range

      // Iterate through other active players
      for (const targetPlayerId in gameState.players) {
        if (targetPlayerId === shooterId) continue; // Don't hit self

        const targetPlayer = gameState.players[targetPlayerId];
        // Access the GLOBAL playerHitSpheres cache
        const targetSphere = playerHitSpheres[targetPlayerId];

        // Check if target is ready, not dead, and has a hitbox
        if (targetPlayer.isReady && !targetPlayer.isDead && targetSphere) {
          // *** DEBUG LOGGING START ***
          const targetPos = targetSphere.center;
          console.log(`[HitCheck ${shooterId}] Checking target ${targetPlayerId} at ${targetPos.x.toFixed(1)},${targetPos.y.toFixed(1)},${targetPos.z.toFixed(1)} Radius: ${targetSphere.radius}`);
          // *** DEBUG LOGGING END ***

          const intersectionPoint = new THREE.Vector3();
          const intersects = laserRay.intersectSphere(targetSphere, intersectionPoint);

          if (intersects) {
            const distanceToHit = startPosVec.distanceTo(intersectionPoint);
            // *** DEBUG LOGGING START ***
            console.log(`[HitCheck ${shooterId}] INTERSECTION with ${targetPlayerId}! Point: ${intersectionPoint.x.toFixed(1)},${intersectionPoint.y.toFixed(1)},${intersectionPoint.z.toFixed(1)} Dist: ${distanceToHit.toFixed(1)}`);
            // *** DEBUG LOGGING END ***

            // Check if the hit is within the laser's max distance AND closer than previous hits
            if (distanceToHit <= maxLaserDist && distanceToHit < hitDistance) {
              // *** DEBUG LOGGING START ***
              console.log(`[HitCheck ${shooterId}] VALID Hit on ${targetPlayerId}. Old hitDistance: ${hitDistance.toFixed(1)}`);
              // *** DEBUG LOGGING END ***
              hitPlayerId = targetPlayerId;
              hitDistance = distanceToHit; // Update closest hit distance
            } else {
               // *** DEBUG LOGGING START ***
               console.log(`[HitCheck ${shooterId}] INVALID Hit on ${targetPlayerId}. distanceToHit (${distanceToHit.toFixed(1)}) vs maxLaserDist (${maxLaserDist.toFixed(1)}), hitDistance (${hitDistance.toFixed(1)})`);
               // *** DEBUG LOGGING END ***
            }
          }
        } else {
            // *** DEBUG LOGGING START ***
            if (targetPlayerId !== shooterId) { // Don't log self-skip
                console.log(`[HitCheck ${shooterId}] Skipping target ${targetPlayerId}. Ready: ${targetPlayer?.isReady}, Dead: ${targetPlayer?.isDead}, Sphere: ${!!targetSphere}`);
            }
            // *** DEBUG LOGGING END ***
        }
      }

      // 7. Process Confirmed Hit
      if (hitPlayerId) {
          // *** DEBUG LOGGING START ***
          console.log(`[HitCheck ${shooterId}] FINAL HIT CONFIRMED on ${hitPlayerId}`);
          // *** DEBUG LOGGING END ***

          // Mark target as dead
          gameState.players[hitPlayerId].isDead = true;

          // Remove target's hitbox from checks (using the GLOBAL function)
          removePlayerHitSphere(hitPlayerId);

          // Get target's final kill count before they die
          const targetFinalKills = gameState.players[hitPlayerId].kills || 0;

          // Increment shooter's kill count
          gameState.players[shooterId].kills = (gameState.players[shooterId].kills || 0) + 1;
          const shooterKills = gameState.players[shooterId].kills;

          // Notify the target player they died
          const targetSocket = io.sockets.sockets.get(hitPlayerId);
          if (targetSocket) {
              targetSocket.emit('playerDied', { finalKills: targetFinalKills }); // Include final kill count
              console.log(`Sent 'playerDied' to target ${hitPlayerId}`);
          }

          // Broadcast to everyone else that this player was hit (for visual hiding)
          io.to(GLOBAL_ROOM).emit('playerHit', { targetId: hitPlayerId });
          console.log(`Broadcast 'playerHit' for target ${hitPlayerId}`);

          // *** NEW: Notify the SHOOTER they got the kill ***
          const shooterSocket = io.sockets.sockets.get(shooterId);
          if (shooterSocket) {
              // Include updated kill count
              shooterSocket.emit('killConfirmed', { 
                  victimId: hitPlayerId, 
                  points: 100,
                  kills: shooterKills
              });
              console.log(`Sent 'killConfirmed' to shooter ${shooterId} with kill count: ${shooterKills}`);
          }

      } else {
           // *** DEBUG LOGGING START ***
           console.log(`[HitCheck ${shooterId}] No valid hit registered.`);
           // *** DEBUG LOGGING END ***
      }
      // --- End Server Hit Detection ---

    } catch (error) {
      console.error(`Error handling laserFired: ${error.message}`, error.stack);
    }
  });

  
  // Handle disconnection
  socket.on('disconnect', () => {
    const disconnectedId = socket.id;
    console.log(`User disconnected: ${disconnectedId}`);

    // Remove hitbox cache entry (using the GLOBAL function)
    removePlayerHitSphere(disconnectedId);

    try {
      chatCooldowns.delete(disconnectedId);
      positionTimestamps.delete(disconnectedId);
      laserTimestamps.delete(disconnectedId);

      if (gameState.players[disconnectedId]) {
        delete gameState.players[disconnectedId];
        io.to(GLOBAL_ROOM).emit('playerLeft', { id: disconnectedId });
        broadcastPlayerCount();
      }
    } catch (error) {
      console.error(`Error handling disconnect: ${error.message}`);
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
  if (getPlayerCount() > 0) {
    io.emit('serverTime', { timestamp: Date.now() });
    console.log('Broadcasting server time update.');
    
    // Also broadcast leaderboard update on the same interval
    broadcastLeaderboard();
  } else {
    console.log('Skipping server time update, no players connected.');
  }
}, 30000);

// Respawn planets every 30 seconds - REVISED
setInterval(() => {
  if (getPlayerCount() > 0) { // Check if players are connected
    // Clear server state BEFORE broadcasting
    gameState.destroyedVoxels.clear();
    console.log('Cleared server destroyed voxel state.');

    // Now broadcast the respawn event
    io.to(GLOBAL_ROOM).emit('respawnPlanets');
    console.log('Broadcasting planet respawn event.');
  } else {
    console.log('Skipping planet respawn broadcast, no players connected.');
  }
}, 30000);