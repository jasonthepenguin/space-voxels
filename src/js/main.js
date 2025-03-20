import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import uiManager, { GameState } from './uiManager.js';
import { io } from 'socket.io-client';
import { serverTimeOffset } from './networking.js';

// Import mobile controls
import {
    initMobileControls,
    showMobileControls,
    hideMobileControls,
    getJoystickValues,
    getLookDelta,
    isFireButtonHeld,
    isFireButtonActive,
    checkIsMobile,
    updateMobileControlsState,
    isBoostActive
} from './mobileControls.js';

// Import modules
import { 
    celestialColors, 
    planetData, 
    createSun, 
    createOrbitLines, 
    createPlanets, 
    createMoon, 
    updatePlanets,
    createExplosion,
    respawnAllCelestialBodies
} from './celestialBodies.js';

import {
    createPlayer,
    handleMovement,
    updateCameraPosition as updatePlayerCamera
} from './player.js';

import {
    MAX_LASERS,
    MAX_FLASHES,
    initWeapons,
    shootLaser,
    updateLasers,
    preloadSounds,
    updateFlashes
} from './weapons.js';

import {
    initNetworking,
    sendPlayerReady,
    sendPlayerNotReady,
    updatePlayerCountUI
} from './networking.js';

import {
    loadStarsTexture,
    createSkybox,
    setupLighting,
    createUI
} from './environment.js';

// Import textures and sounds using ES modules
import skyboxRightUrl from '../assets/textures/skybox_right.png';
import skyboxLeftUrl from '../assets/textures/skybox_left.png';
import skyboxTopUrl from '../assets/textures/skybox_top.png';
import skyboxBottomUrl from '../assets/textures/skybox_bottom.png';
import skyboxFrontUrl from '../assets/textures/skybox_front.png';
import skyboxBackUrl from '../assets/textures/skybox_back.png';
import laserSoundUrl from '../assets/sounds/laser_sound_3.wav';

// Game state variables
let scene, camera, renderer;
let planets = [];
let sun;
let orbitLines = []; // Store references to orbit lines
let clock; // Three.js clock for delta time
let soundPool = [];
const MAX_SOUNDS = 5;
let soundsLoaded = false;
let gameStarted = false; // Track if game has started
let player = null; // Player object - initialized as null
let cameraOffset = new THREE.Vector3(0, 10, 20); // Much higher and further back
let crosshair;
let raycaster;
let cursorLocked = false;


// Laser fire cooldown
let lastShotTime = 0;
const FIRE_COOLDOWN = 200;


// Mobile controls
let isMobile = false;
let mobileControls = null;

// Weapon system variables
let lasers = [];
let laserPool = [];
let flashPool = [];

// Socket.io connection
let socket;
let playerId = null;
let playerCount = 1; // Default to 1 (local player)
let isConnected = false;

// Textures
const textures = {};
const textureLoader = new THREE.TextureLoader();

// Add this shared geometry for all voxels
const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);

// Keyboard state
const remotePlayers = {};

// FOV constants
const DEFAULT_FOV = 75;
const BOOST_FOV = 85;
const FOV_TRANSITION_SPEED = 5; // Speed of FOV transition

// Add these variables near the top with other game state variables
let speedLines = [];
let lastSpeedLineTime = 0;
const SPEED_LINE_INTERVAL = 100; // ms between new speed lines

// Import desktop controls properly and use its exported functions
import { 
    initDesktopControls, 
    isKeyPressed, 
    isLeftMouseHeld, 
    isRightMouseHeld,
    getMouseMovement,
    registerPointerLockCallback
} from './desktopControls.js';

window.respawnPlanets = function() {
    respawnAllCelestialBodies(sun, planets);
    console.log('Planets respawned locally.');
};

window.addOrUpdateRemotePlayer = function(id, data) {
    if (!remotePlayers[id]) {
        // For remote players, we'll use the default ship type for now
        // In a future update, we could sync ship types between players
        const remotePlayer = createPlayer(scene, data.shipType || 'default');
        remotePlayer.name = `remotePlayer_${id}`;
        scene.add(remotePlayer);
        remotePlayers[id] = remotePlayer;

        // Immediately set initial position and rotation
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
};

window.removeRemotePlayer = function(id) {
    const player = remotePlayers[id];
    if (player) {
        scene.remove(player);
        delete remotePlayers[id];
        console.log(`Removed remote player: ${id}`);
    }
};

// Expose gameStarted to window for UI access
Object.defineProperty(window, 'gameStarted', {
    get: function() {
        return gameStarted;
    }
});

// Expose resetGame to window for UI access
window.resetGame = resetGame;

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Initialize clock
    clock = new THREE.Clock();
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Position camera for menu view (don't create player yet)
    camera.position.set(0, 30, 100);
    camera.lookAt(0, 0, 0);
    
    // Initialize UI Manager with camera and game start callback
    uiManager.init(camera, startGame);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Load skybox textures
    const skyboxTextures = [
        skyboxRightUrl,
        skyboxLeftUrl,
        skyboxTopUrl,
        skyboxBottomUrl,
        skyboxFrontUrl,
        skyboxBackUrl
    ];
    const loadedTextures = loadStarsTexture(textureLoader, skyboxTextures);
    Object.assign(textures, loadedTextures);

    // Create skybox with stars
    createSkybox(scene, textures);

    // Setup lighting
    setupLighting(scene);

    // Create UI elements (crosshair)
    crosshair = createUI();

    // Initialize weapon systems
    const weaponSystems = initWeapons(scene);
    laserPool = weaponSystems.laserPool;
    lasers = weaponSystems.lasers;
    flashPool = weaponSystems.flashPool;
    raycaster = weaponSystems.raycaster;

    // Create sun
    sun = createSun(scene, voxelGeometry);

    // Create orbit lines
    orbitLines = createOrbitLines(scene, planetData);

    // Create planets
    planets = createPlanets(scene, voxelGeometry, planetData, serverTimeOffset);

    // Add Earth's moon
    createMoon(planets);

    // Initialize mobile controls
    mobileControls = initMobileControls();
    
    isMobile = mobileControls ? mobileControls.isMobile : false;

    // Setup event listeners
    setupEventListeners();
    
    // Connect to multiplayer server
    const networkingData = initNetworking(updatePlayerCount);
    socket = networkingData.socket;
    playerId = networkingData.playerId;
    isConnected = networkingData.isConnected;

    // Register pointer lock callback if needed
    registerPointerLockCallback((isLocked) => {
        cursorLocked = isLocked;
        // Any other code you want to run when pointer lock state changes
    });
    
    // Start animation loop
    animate();
    
    // Preload sounds
    soundPool = preloadSounds(laserSoundUrl, MAX_SOUNDS);
    soundsLoaded = true;
    
    console.log("Game initialized successfully");
    console.log("Mobile device detected:", isMobile);

    // Create boost indicator
    const boostIndicator = document.createElement('div');
    boostIndicator.id = 'boost-indicator';
    document.body.appendChild(boostIndicator);

    // Make UI Manager accessible globally for other modules
    window.uiManager = uiManager;
}

// Update player count in UI
function updatePlayerCount(count) {
    playerCount = count;
    updatePlayerCountUI(count);
}

function setupEventListeners() {            
    const isMobile = checkIsMobile();

    if (isMobile) {
        initMobileControls();
    } else {
        initDesktopControls();
    }
    
    // Window resize event
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

const POSITION_UPDATE_INTERVAL = 100; // milliseconds (10 updates per second)
let lastPositionUpdate = 0;
const REMOTE_PLAYER_LERP_FACTOR = 0.2;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const currentTime = performance.now();

    if (uiManager.isPlaying() && player) {
        // Handle desktop look controls
        if (!isMobile) {
            const lookDelta = getMouseMovement();
            
            if (lookDelta.x !== 0 || lookDelta.y !== 0) {
                // Initialize camera offset angles if needed
                if (!cameraOffset.angles) {
                    cameraOffset.angles = { yaw: 0, pitch: 0 };
                }
                
                // Apply look delta to camera angles
                cameraOffset.angles.yaw -= lookDelta.x * 0.002;
                
                // Limit vertical rotation to prevent flipping
                cameraOffset.angles.pitch = Math.max(-Math.PI/2, 
                                            Math.min(Math.PI/2, 
                                            cameraOffset.angles.pitch - lookDelta.y * 0.002));
            }
        }
        
        // Handle mobile look controls
        if (isMobile) {
            const lookDelta = getLookDelta();
            
            if (lookDelta.x !== 0 || lookDelta.y !== 0) {
                // Initialize camera offset angles if needed
                if (!cameraOffset.angles) {
                    cameraOffset.angles = { yaw: 0, pitch: 0 };
                }
                
                // Apply look delta to camera angles
                cameraOffset.angles.yaw -= lookDelta.x * 0.002;
                
                // Limit vertical rotation to prevent flipping
                cameraOffset.angles.pitch = Math.max(-Math.PI/2, 
                                            Math.min(Math.PI/2, 
                                            cameraOffset.angles.pitch - lookDelta.y * 0.002));
            }
            
            // Update mobile controls state
            updateMobileControlsState();
        }
        
        // Handle player movement with mobile controls if on mobile
        handleMovement(player, delta, updateCameraPosition, isMobile ? {
            isMobile: true,
            getJoystickValues: getJoystickValues,
            isBoostActive: isBoostActive
        } : {
            isKeyPressed: isKeyPressed
        });

        // Auto fire handler
        handleAutoFire(currentTime);



        if (isConnected && socket && currentTime - lastPositionUpdate > POSITION_UPDATE_INTERVAL) {
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

            lastPositionUpdate = currentTime;
        }

        // Handle FOV changes for boost effect
        updateFOV(delta, player.userData.boostActive);

        // Handle speed lines for boost effect
        if (player.userData.boostActive) {
            if (currentTime - lastSpeedLineTime > SPEED_LINE_INTERVAL) {
                createSpeedLine();
                lastSpeedLineTime = currentTime;
            }
        }
    }

    // Interpolate remote players
    for (const id in remotePlayers) {
        const remotePlayer = remotePlayers[id];
        if (remotePlayer.userData.targetPosition && remotePlayer.userData.targetRotation) {
            remotePlayer.position.lerp(remotePlayer.userData.targetPosition, REMOTE_PLAYER_LERP_FACTOR);

            remotePlayer.rotation.x = THREE.MathUtils.lerp(
                remotePlayer.rotation.x,
                remotePlayer.userData.targetRotation.x,
                REMOTE_PLAYER_LERP_FACTOR
            );
            remotePlayer.rotation.y = THREE.MathUtils.lerp(
                remotePlayer.rotation.y,
                remotePlayer.userData.targetRotation.y,
                REMOTE_PLAYER_LERP_FACTOR
            );
            remotePlayer.rotation.z = THREE.MathUtils.lerp(
                remotePlayer.rotation.z,
                remotePlayer.userData.targetRotation.z,
                REMOTE_PLAYER_LERP_FACTOR
            );
        }
    }

    updatePlanets(planets, delta);
    updateLasers(lasers, delta);
    updateFlashes(flashPool, delta);

    // Update boost indicator
    const boostIndicator = document.getElementById('boost-indicator');
    if (boostIndicator) {
        if (player && player.userData.boostActive) {
            boostIndicator.style.opacity = '1';
        } else {
            boostIndicator.style.opacity = '0';
        }
    }

    renderer.render(scene, camera);
}

// Update camera position based on player position and rotation
function updateCameraPosition() {
    if (player) {
        updatePlayerCamera(player, camera, cameraOffset, isMobile ? {
            isMobile: true,
            getLookDelta: getLookDelta
        } : null);
    }
}

// Update this function to use the correct left mouse held status from desktop controls
function handleAutoFire(currentTime) {
    if (!player || !uiManager.isPlaying()) return;

    if ((isLeftMouseHeld() || (isMobile && isFireButtonHeld())) && (currentTime - lastShotTime >= FIRE_COOLDOWN)) {
        shootLaser(
            scene, 
            player, 
            raycaster, 
            laserPool, 
            lasers, 
            flashPool, 
            soundPool, 
            soundsLoaded, 
            orbitLines, 
            sun, 
            planets, 
            socket, 
            remotePlayers
        );
        lastShotTime = currentTime;
    }
}

// New function to start the game
function startGame() {
    gameStarted = true;
    
    // Get the selected ship type from the UI manager
    const selectedShipType = uiManager.getSelectedShip();
    console.log(`Starting game with ship: ${selectedShipType}`);
    
    // Create player with the selected ship type
    player = createPlayer(scene, selectedShipType);
    cameraOffset.angles = { yaw: 0, pitch: 0 };
    updateCameraPosition();
    
    // Show mobile controls if on mobile
    if (isMobile) {
        showMobileControls();
    }
    
    sendPlayerReady(socket, isConnected, selectedShipType);
}

// New function to reset the game state
function resetGame() {
    console.log("Resetting game...");
    
    // Reset game state
    gameStarted = false;
    
    // Remove player from scene if it exists
    if (player) {
        scene.remove(player);
        player = null;
    }
    
    // Reset camera to initial position
    camera.position.set(0, 30, 100);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    
    // Clear any active lasers
    lasers.forEach(laser => {
        laser.visible = false;
    });
    lasers = [];
    
    // Hide mobile controls if on mobile
    if (isMobile) {
        hideMobileControls();
    }
    
    // Notify server that player has left game mode
    sendPlayerNotReady(socket, isConnected);
}

// Initialize the game when the window loads
window.addEventListener('load', function() {
    console.log("Window loaded, initializing game...");
    init();
});

// New function to handle FOV transitions
function updateFOV(delta, boostActive) {
    if (!camera) return;
    
    const targetFOV = boostActive ? BOOST_FOV : DEFAULT_FOV;
    
    // Smoothly transition FOV
    if (Math.abs(camera.fov - targetFOV) > 0.1) {
        if (camera.fov < targetFOV) {
            camera.fov = Math.min(camera.fov + FOV_TRANSITION_SPEED * delta * 60, targetFOV);
        } else {
            camera.fov = Math.max(camera.fov - FOV_TRANSITION_SPEED * delta * 60, targetFOV);
        }
        camera.updateProjectionMatrix();
    }
    
    // Add motion blur effect when boosting
    if (boostActive) {
        if (!window.boostOverlay) {
            createBoostOverlay();
        }
        window.boostOverlay.style.opacity = '0.4'; // Show the overlay
    } else if (window.boostOverlay) {
        window.boostOverlay.style.opacity = '0'; // Hide the overlay
    }
}

// Create a boost overlay element for motion blur effect
function createBoostOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'boost-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'radial-gradient(circle, transparent 60%, rgba(255,255,255,0.3) 100%)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '90';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(overlay);
    window.boostOverlay = overlay;
}

// Add this function to create speed lines
function createSpeedLine() {
    const line = document.createElement('div');
    line.className = 'speed-line';
    
    // Random position and size
    const y = Math.random() * window.innerHeight;
    const width = 20 + Math.random() * 100;
    const height = 1 + Math.random() * 2;
    
    line.style.top = `${y}px`;
    line.style.width = `${width}px`;
    line.style.height = `${height}px`;
    line.style.left = `${Math.random() * 20}%`;
    
    // Random rotation for more dynamic effect
    const angle = -10 + Math.random() * 20;
    line.style.transform = `rotate(${angle}deg)`;
    
    document.body.appendChild(line);
    
    // Remove the line after animation completes
    setTimeout(() => {
        if (line.parentNode) {
            line.parentNode.removeChild(line);
        }
    }, 500);
}

// Improved respawn function for remote players
function respawnRemotePlayer(playerId, position) {
    console.log(`Attempting to respawn player: ${playerId}`);
    
    if (!remotePlayers[playerId]) {
        console.error(`Remote player ${playerId} not found in remotePlayers object`);
        return;
    }
    
    const remotePlayer = remotePlayers[playerId];
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

// Expose the function to the window object for networking
window.respawnRemotePlayer = respawnRemotePlayer;

// Add this function for testing
window.testHitPlayer = function(playerId) {
    if (socket && remotePlayers[playerId]) {
        console.log(`Manually testing hit on player: ${playerId}`);
        socket.emit('playerHit', { 
            targetId: playerId,
            position: {
                x: Math.random() * 100 - 50,
                y: Math.random() * 50 + 10,
                z: Math.random() * 100 - 50
            }
        });
        return true;
    }
    return false;
};

// Add this function to respawn the local player
function respawnLocalPlayer() {
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
        socket.emit('updatePosition', {
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

// Expose the function to the window object for networking
window.respawnLocalPlayer = respawnLocalPlayer;