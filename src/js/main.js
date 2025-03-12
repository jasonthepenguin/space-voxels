import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import uiManager, { GameState } from './uiManager.js';
import { io } from 'socket.io-client';

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
    preloadSounds
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
    createUI,
    setupControls,
    handlePointerLockChange
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
let mouse = new THREE.Vector2();
let leftMouseHeld = false;
let cursorLocked = false;

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
const keyboard = {};

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
    planets = createPlanets(scene, voxelGeometry, planetData);

    // Add Earth's moon
    createMoon(planets);

    // Setup event listeners
    setupEventListeners();
    
    // Setup controls
    setupControls();
    
    // Connect to multiplayer server
    const networkingData = initNetworking(updatePlayerCount);
    socket = networkingData.socket;
    playerId = networkingData.playerId;
    isConnected = networkingData.isConnected;

    // Start animation loop
    animate();
    
    // Preload sounds
    soundPool = preloadSounds(laserSoundUrl, MAX_SOUNDS);
    soundsLoaded = true;
    
    console.log("Game initialized successfully");
}

// Update player count in UI
function updatePlayerCount(count) {
    playerCount = count;
    updatePlayerCountUI(count);
}

function setupEventListeners() {
    // Keyboard event listeners
    document.addEventListener('keydown', (event) => {
        keyboard[event.code] = true;
        
        // Quit with Escape key
        if (event.code === 'Escape') {
            // Only exit pointer lock if game is started
            if (gameStarted && cursorLocked) {
                document.exitPointerLock = document.exitPointerLock || 
                                          document.mozExitPointerLock ||
                                          document.webkitExitPointerLock;
                document.exitPointerLock();
                
                // Explicitly reset the game when Escape is pressed
                resetGame();
                
                // Explicitly return to menu
                if (uiManager) {
                    uiManager.changeState(GameState.MAIN_MENU);
                }
            }
        }
        
        // Respawn all celestial bodies with 'R' key
        if (event.code === 'KeyR' && gameStarted) {
            console.log("Respawning all celestial bodies");
            respawnAllCelestialBodies(sun, planets);
        }
    });
    
    document.addEventListener('keyup', (event) => {
        keyboard[event.code] = false;
    });
    
    // Mouse event listeners
    document.addEventListener('mousedown', (event) => {
        if (event.button === 0 && cursorLocked && uiManager.isPlaying()) { // Only shoot if game started
            leftMouseHeld = true;
            shootLaser(scene, player, raycaster, laserPool, lasers, flashPool, soundPool, soundsLoaded, orbitLines, sun, planets);
        }
    });
    
    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) {
            leftMouseHeld = false;
        }
    });
    
    // Mouse movement for camera rotation only (not ship rotation)
    document.addEventListener('mousemove', (event) => {
        if (cursorLocked && uiManager.isPlaying() && player) { // Only rotate camera if game started
            // Calculate camera offset based on mouse movement
            // This doesn't affect the ship's rotation, only where the player is looking
            const cameraYaw = -event.movementX * 0.002;
            const cameraPitch = -event.movementY * 0.002;
            
            // Apply to camera offset angles (stored as properties on the offset vector)
            if (!cameraOffset.angles) {
                cameraOffset.angles = { yaw: 0, pitch: 0 };
            }
            
            cameraOffset.angles.yaw += cameraYaw;
            
            // Limit vertical rotation to prevent flipping
            cameraOffset.angles.pitch = Math.max(-Math.PI/2, 
                                        Math.min(Math.PI/2, 
                                        cameraOffset.angles.pitch + cameraPitch));
            
            // Update camera position
            updateCameraPosition();
        }
    });
    
    // Window resize event
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Add listener for the start button
    document.addEventListener('pointerlockchange', function() {
        cursorLocked = handlePointerLockChange();
        if (document.pointerLockElement === document.body && !gameStarted) {
            startGame();
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    // Get delta time from Three.js clock
    const delta = clock.getDelta();
    
    // Only handle player movement if game is in playing state
    if (uiManager.isPlaying()) {
        // Handle player movement
        if (player) {
            handleMovement(player, keyboard, delta, updateCameraPosition);
        }
        
        // Update camera position only if we're not in a menu animation
        if (!window.cameraAnimating) {
            updateCameraPosition();
        }
    }
    
    // Update planet positions
    updatePlanets(planets, delta);
    
    // Update lasers
    updateLasers(lasers, delta);
    
    // Render the scene
    renderer.render(scene, camera);
}

// Update camera position based on player position and rotation
function updateCameraPosition() {
    if (player) {
        updatePlayerCamera(player, camera, cameraOffset);
    }
}

// New function to start the game
function startGame() {
    console.log("Starting game...");
    gameStarted = true;
    
    // Create player now that game is starting
    player = createPlayer(scene);
    
    // Initialize camera offset angles
    cameraOffset.angles = { yaw: 0, pitch: 0 };
    
    // Update camera position to follow player
    updateCameraPosition();
    
    // Send player ready event to server
    sendPlayerReady(socket, isConnected);
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
    
    // Notify server that player has left game mode
    sendPlayerNotReady(socket, isConnected);
}

// Initialize the game when the window loads
window.addEventListener('load', function() {
    console.log("Window loaded, initializing game...");
    init();
});