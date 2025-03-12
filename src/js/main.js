import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import uiManager, { GameState } from './uiManager.js';
import { io } from 'socket.io-client';

// Game state variables
let scene, camera, renderer, controls;
let planets = [];
let sun;
let lasers = [];
let laserPool = [];
const MAX_LASERS = 20;
let flashPool = [];
const MAX_FLASHES = 10;
let crosshair;
let raycaster;
let mouse = new THREE.Vector2();
let leftMouseHeld = false;
let cursorLocked = false;
let player = null; // Player object - initialized as null
let cameraOffset = new THREE.Vector3(0, 10, 20); // Much higher and further back
let orbitLines = []; // Store references to orbit lines
let clock; // Three.js clock for delta time
let soundPool = [];
const MAX_SOUNDS = 5;
let soundsLoaded = false;
let gameStarted = false; // Track if game has started

// Import textures and sounds using ES modules
import skyboxRightUrl from '../assets/textures/skybox_right.png';
import skyboxLeftUrl from '../assets/textures/skybox_left.png';
import skyboxTopUrl from '../assets/textures/skybox_top.png';
import skyboxBottomUrl from '../assets/textures/skybox_bottom.png';
import skyboxFrontUrl from '../assets/textures/skybox_front.png';
import skyboxBackUrl from '../assets/textures/skybox_back.png';
import laserSoundUrl from '../assets/sounds/laser_sound_3.wav';

// Socket.io connection
let socket;
let roomId = null;
let playerId = null;
let playerCount = 1; // Default to 1 (local player)
let isConnected = false;

// Backend server URL - will use environment variable in production
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

// Expose gameStarted to window for UI access
Object.defineProperty(window, 'gameStarted', {
    get: function() {
        return gameStarted;
    }
});

// Expose resetGame to window for UI access
window.resetGame = resetGame;

// Textures
const textures = {};
const textureLoader = new THREE.TextureLoader();

// Add this shared geometry for all voxels
const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);

// Colors for celestial bodies
const celestialColors = {
    sun: 0xffff88,
    mercury: 0x888888,
    venus: 0xffff00,
    earthWater: 0x0000ff,
    earthLand: 0x00ff00,
    mars: 0xff0000,
    jupiterOrange: 0xff8800,
    jupiterYellow: 0xffff00,
    jupiterRed: 0xff4400,
    saturnYellow: 0xffff00,
    saturnOrange: 0xff8800,
    uranus: 0x88ccff,
    neptune: 0x0000ff,
    moon: 0xffffff,
    stars: 0x222244
};

// Keyboard state
const keyboard = {};

// Global scaling factors
const ORBIT_SPEED_MULTIPLIER = 12; // This replaces the 3*4 factor
const PLANET_SIZE_MULTIPLIER = 2;  // Controls overall planet sizes
const ORBIT_RADIUS_MULTIPLIER = 1.2; // Controls distances between planets

// Ship movement parameters
const SHIP_SPEED = 15; // Constant forward speed
const SHIP_TURN_SPEED = 1.5; // How quickly the ship rotates
const SHIP_PITCH_SPEED = 1.0; // How quickly the ship pitches up/down
const SHIP_ROLL_SPEED = 1.2; // How quickly the ship rolls

// Planet data: name, size, orbit_radius, orbit_speed
const planetData = [
    { name: 'Mercury', 
      size: 1 * PLANET_SIZE_MULTIPLIER, 
      orbitRadius: 12 * ORBIT_RADIUS_MULTIPLIER, 
      orbitSpeed: 0.04 * ORBIT_SPEED_MULTIPLIER },
    
    { name: 'Venus', 
      size: 2 * PLANET_SIZE_MULTIPLIER, 
      orbitRadius: 16 * ORBIT_RADIUS_MULTIPLIER, 
      orbitSpeed: 0.015 * ORBIT_SPEED_MULTIPLIER },
    
    { name: 'Earth', 
      size: 2 * PLANET_SIZE_MULTIPLIER, 
      orbitRadius: 22 * ORBIT_RADIUS_MULTIPLIER, 
      orbitSpeed: 0.01 * ORBIT_SPEED_MULTIPLIER },
    
    { name: 'Mars', 
      size: 1.5 * PLANET_SIZE_MULTIPLIER, 
      orbitRadius: 28 * ORBIT_RADIUS_MULTIPLIER, 
      orbitSpeed: 0.008 * ORBIT_SPEED_MULTIPLIER },
    
    { name: 'Jupiter', 
      size: 4 * PLANET_SIZE_MULTIPLIER, 
      orbitRadius: 40 * ORBIT_RADIUS_MULTIPLIER, 
      orbitSpeed: 0.002 * ORBIT_SPEED_MULTIPLIER },
    
    { name: 'Saturn', 
      size: 3.5 * PLANET_SIZE_MULTIPLIER, 
      orbitRadius: 55 * ORBIT_RADIUS_MULTIPLIER, 
      orbitSpeed: 0.0015 * ORBIT_SPEED_MULTIPLIER },
    
    { name: 'Uranus', 
      size: 3 * PLANET_SIZE_MULTIPLIER, 
      orbitRadius: 70 * ORBIT_RADIUS_MULTIPLIER, 
      orbitSpeed: 0.001 * ORBIT_SPEED_MULTIPLIER },
    
    { name: 'Neptune', 
      size: 3 * PLANET_SIZE_MULTIPLIER, 
      orbitRadius: 85 * ORBIT_RADIUS_MULTIPLIER, 
      orbitSpeed: 0.0008 * ORBIT_SPEED_MULTIPLIER }
];

// Connect to Socket.io server
function connectToServer() {
  console.log(`Connecting to Socket.io server at ${SOCKET_SERVER_URL}`);
  
  // Get room ID from URL or generate a random one
  const urlParams = new URLSearchParams(window.location.search);
  roomId = urlParams.get('room') || generateRoomId();
  
  // Update URL with room ID for sharing
  if (!urlParams.has('room')) {
    const newUrl = `${window.location.pathname}?room=${roomId}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
  }
  
  console.log(`Joining room: ${roomId}`);
  
  // Connect to server with more detailed logging
  try {
    socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      query: { roomId },
      reconnectionAttempts: 5,
      timeout: 10000
    });
    
    // Connection events with more detailed logging
    socket.on('connect', () => {
      console.log('Connected to server with socket ID:', socket.id);
      isConnected = true;
      playerId = socket.id;
      
      // Join room
      socket.emit('joinRoom', { roomId });
      console.log(`Sent joinRoom event for room: ${roomId}`);
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
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    // More event handlers will be added later for position updates, etc.
  } catch (error) {
    console.error('Error initializing socket connection:', error);
  }
}

// Generate a random room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

// Update player count in UI
function updatePlayerCount(count) {
  playerCount = count;
  const playersCounterElement = document.getElementById('players-counter');
  if (playersCounterElement) {
    playersCounterElement.textContent = `Players Online: ${count}`;
  }
}

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

    // Load stars texture for skybox
    loadStarsTexture();

    // Create skybox with stars
    createSkybox();

    // Setup lighting
    setupLighting();

    // Create UI elements (crosshair)
    createUI();

    // Create sun
    createSun();

    // Create planets
    createPlanets();

    // Add Earth's moon
    createMoon();

    // Initialize raycaster for laser shooting
    raycaster = new THREE.Raycaster();

    // Setup event listeners
    setupEventListeners();
    
    // Setup controls
    setupControls();
    
    // Connect to multiplayer server
    connectToServer();

    // Start animation loop
    animate();
    
    preloadSounds();
    
    console.log("Game initialized successfully");
}

function loadStarsTexture() {
    // Load all 6 skybox textures using imported URLs
    const skyboxTextures = [
        skyboxRightUrl,
        skyboxLeftUrl,
        skyboxTopUrl,
        skyboxBottomUrl,
        skyboxFrontUrl,
        skyboxBackUrl
    ];
    
    skyboxTextures.forEach((textureUrl, index) => {
        textures[`skybox_${index}`] = textureLoader.load(
            textureUrl,
            undefined,
            undefined,
            () => {
                console.warn(`Could not load skybox texture ${index}, using fallback color`);
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = `#${celestialColors.stars.toString(16).padStart(6, '0')}`;
                ctx.fillRect(0, 0, 128, 128);
                
                const fallbackTexture = new THREE.CanvasTexture(canvas);
                textures[`skybox_${index}`] = fallbackTexture;
            }
        );
    });
}

function createSkybox() {
    const skyGeometry = new THREE.BoxGeometry(500, 500, 500);
    
    // Create materials for each face of the skybox using the loaded textures
    const skyMaterials = [
        new THREE.MeshBasicMaterial({ map: textures['skybox_0'], side: THREE.BackSide }), // right
        new THREE.MeshBasicMaterial({ map: textures['skybox_1'], side: THREE.BackSide }), // left
        new THREE.MeshBasicMaterial({ map: textures['skybox_2'], side: THREE.BackSide }), // top
        new THREE.MeshBasicMaterial({ map: textures['skybox_3'], side: THREE.BackSide }), // bottom
        new THREE.MeshBasicMaterial({ map: textures['skybox_4'], side: THREE.BackSide }), // front
        new THREE.MeshBasicMaterial({ map: textures['skybox_5'], side: THREE.BackSide })  // back
    ];
    
    const skybox = new THREE.Mesh(skyGeometry, skyMaterials);
    scene.add(skybox);
}

function setupLighting() {
    // Ambient light - increase intensity
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Brighter ambient light
    scene.add(ambientLight);
    
    // Directional light (from the sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Brighter directional light
    directionalLight.position.set(0, 0, 0); // Light from the sun's position
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Add hemisphere light for better overall illumination
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
    scene.add(hemisphereLight);
}

function setupControls() {
    // Add pointer lock event listeners
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mozpointerlockchange', handlePointerLockChange);
    document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
}

// Handle pointer lock change events
function handlePointerLockChange() {
    if (document.pointerLockElement === document.body || 
        document.mozPointerLockElement === document.body ||
        document.webkitPointerLockElement === document.body) {
        // Pointer is locked
        cursorLocked = true;
    } else {
        // Pointer is unlocked
        cursorLocked = false;
    }
}

function createUI() {
    // Create crosshair
    const crosshairElement = document.createElement('div');
    crosshairElement.id = 'crosshair';
    crosshairElement.style.position = 'absolute';
    crosshairElement.style.top = '50%';
    crosshairElement.style.left = '50%';
    crosshairElement.style.width = '10px';
    crosshairElement.style.height = '10px';
    crosshairElement.style.borderRadius = '50%';
    crosshairElement.style.border = '1px solid rgba(255, 255, 255, 0.7)';
    crosshairElement.style.transform = 'translate(-50%, -50%)';
    crosshairElement.style.pointerEvents = 'none';
    crosshairElement.style.display = 'none'; // Hide initially
    document.body.appendChild(crosshairElement);
}

function createSun() {
    sun = new THREE.Group();
    sun.name = "Sun";
    sun.blockDict = {};
    
    // Count voxels first
    let voxelCount = 0;
    for (let x = -5; x <= 5; x++) {
        for (let y = -5; y <= 5; y++) {
            for (let z = -5; z <= 5; z++) {
                if (x*x + y*y + z*z <= 25) {
                    voxelCount++;
                }
            }
        }
    }
    
    // Create instanced mesh
    const voxelMaterial = new THREE.MeshStandardMaterial({ 
        color: celestialColors.sun,
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    });
    const sunMesh = new THREE.InstancedMesh(voxelGeometry, voxelMaterial, voxelCount);
    
    // Set positions for each instance
    const matrix = new THREE.Matrix4();
    let index = 0;
    
    for (let x = -5; x <= 5; x++) {
        for (let y = -5; y <= 5; y++) {
            for (let z = -5; z <= 5; z++) {
                if (x*x + y*y + z*z <= 25) {
                    matrix.setPosition(x, y, z);
                    sunMesh.setMatrixAt(index, matrix);
                    
                    // Store voxel index in dictionary with position as key
                    sun.blockDict[`${x},${y},${z}`] = index;
                    
                    index++;
                }
            }
        }
    }
    
    // Update the instance matrix buffer
    sunMesh.instanceMatrix.needsUpdate = true;
    
    sun.add(sunMesh);
    sun.instancedMesh = sunMesh; // Store reference to the instanced mesh
    
    scene.add(sun);
}

function createPlanets() {
    // Create orbit lines to help locate planets
    createOrbitLines();
    
    planetData.forEach(data => {
        const planet = new THREE.Group();
        planet.name = data.name;
        planet.orbitRadius = data.orbitRadius;
        planet.orbitSpeed = data.orbitSpeed;
        planet.orbitAngle = Math.random() * Math.PI * 2;
        planet.blockDict = {};
        
        const voxelRange = Math.floor(data.size) + 1;
        const maxDistance = data.size * data.size;
        
        // Count voxels first
        let voxelCount = 0;
        for (let x = -voxelRange; x <= voxelRange; x++) {
            for (let y = -voxelRange; y <= voxelRange; y++) {
                for (let z = -voxelRange; z <= voxelRange; z++) {
                    if (x*x + y*y + z*z <= maxDistance) {
                        voxelCount++;
                    }
                }
            }
        }
        
        // Create instanced mesh with appropriate material
        let planetMaterial;
        
        if (data.name === 'Earth') {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                emissive: 0x003366,
                emissiveIntensity: 0.3
            });
        } else if (data.name === 'Jupiter') {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                emissive: 0xff8800,
                emissiveIntensity: 0.3
            });
        } else if (data.name === 'Saturn') {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                emissive: 0xff8800,
                emissiveIntensity: 0.3
            });
        } else if (data.name === 'Venus') {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                emissive: 0xffff00,
                emissiveIntensity: 0.3
            });
        } else if (data.name === 'Mars') {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                color: celestialColors.mars,
                emissive: 0xff4400,
                emissiveIntensity: 0.3
            });
        } else if (data.name === 'Mercury') {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                color: celestialColors.mercury,
                emissive: 0x888888,
                emissiveIntensity: 0.3
            });
        } else if (data.name === 'Uranus') {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                color: celestialColors.uranus,
                emissive: 0x00ccff,
                emissiveIntensity: 0.3
            });
        } else if (data.name === 'Neptune') {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                color: celestialColors.neptune,
                emissive: 0x0066ff,
                emissiveIntensity: 0.3
            });
        }
        
        const planetMesh = new THREE.InstancedMesh(voxelGeometry, planetMaterial, voxelCount);
        
        // For planets that need different colors per voxel
        let useInstanceColors = ['Earth', 'Jupiter', 'Saturn', 'Venus'].includes(data.name);
        if (useInstanceColors) {
            planetMesh.instanceColor = new THREE.InstancedBufferAttribute(
                new Float32Array(voxelCount * 3), 3
            );
        }
        
        // Set positions and colors for each instance
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        let index = 0;
        
        for (let x = -voxelRange; x <= voxelRange; x++) {
            for (let y = -voxelRange; y <= voxelRange; y++) {
                for (let z = -voxelRange; z <= voxelRange; z++) {
                    if (x*x + y*y + z*z <= maxDistance) {
                        // Set position
                        matrix.setPosition(x, y, z);
                        planetMesh.setMatrixAt(index, matrix);
                        
                        // Set color if needed
                        if (useInstanceColors) {
                            if (data.name === 'Earth') {
                                color.set(Math.random() < 0.7 ? celestialColors.earthWater : celestialColors.earthLand);
                            } else if (data.name === 'Jupiter') {
                                const band = (y + voxelRange) % 3;
                                if (band === 0) color.set(celestialColors.jupiterOrange);
                                else if (band === 1) color.set(celestialColors.jupiterYellow);
                                else color.set(celestialColors.jupiterRed);
                            } else if (data.name === 'Saturn') {
                                const band = (y + voxelRange) % 2;
                                color.set(band === 0 ? celestialColors.saturnYellow : celestialColors.saturnOrange);
                            } else if (data.name === 'Venus') {
                                const patternValue = (x + y + z) % 4;
                                if (patternValue === 0) color.set(celestialColors.saturnYellow);
                                else if (patternValue === 1) color.set(celestialColors.jupiterOrange);
                                else if (patternValue === 2) color.set(celestialColors.saturnYellow);
                                else color.set(celestialColors.moon);
                            }
                            planetMesh.setColorAt(index, color);
                        }
                        
                        // Store voxel index in dictionary with position as key
                        planet.blockDict[`${x},${y},${z}`] = index;
                        
                        index++;
                    }
                }
            }
        }
        
        // Update the instance buffers
        planetMesh.instanceMatrix.needsUpdate = true;
        if (useInstanceColors) {
            planetMesh.instanceColor.needsUpdate = true;
        }
        
        planet.add(planetMesh);
        planet.instancedMesh = planetMesh; // Store reference to the instanced mesh
        
        // Add Saturn's rings if this is Saturn
        if (data.name === 'Saturn') {
            createSaturnRings(planet, data.size);
        }
        
        // Set initial position
        planet.position.x = Math.cos(planet.orbitAngle) * planet.orbitRadius;
        planet.position.z = Math.sin(planet.orbitAngle) * planet.orbitRadius;
        
        scene.add(planet);
        planets.push(planet);
    });
}

// Create orbit lines to help visualize where planets are
function createOrbitLines() {
    planetData.forEach(data => {
        const orbitGeometry = new THREE.RingGeometry(data.orbitRadius - 0.1, data.orbitRadius + 0.1, 64);
        const orbitMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        });
        const orbitLine = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbitLine.rotation.x = Math.PI / 2; // Rotate to horizontal plane
        orbitLine.name = "OrbitLine_" + data.name; // Give each orbit line a unique name
        scene.add(orbitLine);
        
        // Store reference to orbit line
        orbitLines.push(orbitLine);
    });
}

function createSaturnRings(planet, planetSize) {
    const ringRadius = 6 * (planetSize / 3.5);
    const ringThickness = 0.5 * (planetSize / 3.5);
    
    planet.ringDict = {};
    
    // Count ring voxels first
    let ringVoxelCount = 0;
    for (let x = -ringRadius; x <= ringRadius; x++) {
        for (let z = -ringRadius; z <= ringRadius; z++) {
            const distanceFromCenter = Math.sqrt(x*x + z*z);
            if (4 * (planetSize / 3.5) <= distanceFromCenter && distanceFromCenter <= ringRadius) {
                ringVoxelCount++;
            }
        }
    }
    
    // Create instanced mesh for rings
    const ringMaterial = new THREE.MeshStandardMaterial({ 
        color: celestialColors.saturnOrange,
        emissive: 0xff8800,
        emissiveIntensity: 0.3
    });
    
    const ringGeometry = new THREE.BoxGeometry(1, ringThickness, 1);
    const ringMesh = new THREE.InstancedMesh(ringGeometry, ringMaterial, ringVoxelCount);
    
    // Set positions for each instance
    const matrix = new THREE.Matrix4();
    let index = 0;
    
    for (let x = -ringRadius; x <= ringRadius; x++) {
        for (let z = -ringRadius; z <= ringRadius; z++) {
            const distanceFromCenter = Math.sqrt(x*x + z*z);
            if (4 * (planetSize / 3.5) <= distanceFromCenter && distanceFromCenter <= ringRadius) {
                matrix.setPosition(x, 0, z);
                ringMesh.setMatrixAt(index, matrix);
                
                // Store ring voxel index in dictionary
                planet.ringDict[`${x},0,${z}`] = index;
                
                index++;
            }
        }
    }
    
    // Update the instance matrix buffer
    ringMesh.instanceMatrix.needsUpdate = true;
    
    planet.add(ringMesh);
    planet.ringInstancedMesh = ringMesh; // Store reference to the ring instanced mesh
}

function createMoon() {
    // Find Earth
    const earth = planets.find(planet => planet.name === 'Earth');
    
    if (earth) {
        const moon = new THREE.Group();
        moon.name = 'Moon';
        moon.parent = earth;
        moon.position.set(5, 0, 0);
        moon.rotationSpeed = 0.08;
        moon.rotationAngle = 0;
        moon.blockDict = {};
        
        const moonSize = 0.7;
        const moonVoxelRange = Math.floor(moonSize) + 1;
        const moonMaxDistance = moonSize * moonSize;
        
        // Count moon voxels first
        let moonVoxelCount = 0;
        for (let x = -moonVoxelRange; x <= moonVoxelRange; x++) {
            for (let y = -moonVoxelRange; y <= moonVoxelRange; y++) {
                for (let z = -moonVoxelRange; z <= moonVoxelRange; z++) {
                    if (x*x + y*y + z*z <= moonMaxDistance) {
                        moonVoxelCount++;
                    }
                }
            }
        }
        
        // Create instanced mesh for moon
        const moonMaterial = new THREE.MeshStandardMaterial({ 
            color: celestialColors.moon,
            emissive: 0xaaaaaa,
            emissiveIntensity: 0.2
        });
        
        const moonMesh = new THREE.InstancedMesh(voxelGeometry, moonMaterial, moonVoxelCount);
        
        // Set positions for each instance
        const matrix = new THREE.Matrix4();
        let index = 0;
        
        for (let x = -moonVoxelRange; x <= moonVoxelRange; x++) {
            for (let y = -moonVoxelRange; y <= moonVoxelRange; y++) {
                for (let z = -moonVoxelRange; z <= moonVoxelRange; z++) {
                    if (x*x + y*y + z*z <= moonMaxDistance) {
                        matrix.setPosition(x, y, z);
                        moonMesh.setMatrixAt(index, matrix);
                        
                        // Store voxel index in dictionary
                        moon.blockDict[`${x},${y},${z}`] = index;
                        
                        index++;
                    }
                }
            }
        }
        
        // Update the instance matrix buffer
        moonMesh.instanceMatrix.needsUpdate = true;
        
        moon.add(moonMesh);
        moon.instancedMesh = moonMesh; // Store reference to the instanced mesh
        
        earth.add(moon);
        earth.moon = moon;
    }
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
    });
    
    document.addEventListener('keyup', (event) => {
        keyboard[event.code] = false;
    });
    
    // Mouse event listeners
    document.addEventListener('mousedown', (event) => {
        if (event.button === 0 && cursorLocked && uiManager.isPlaying()) { // Only shoot if game started
            leftMouseHeld = true;
            shootLaser();
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
        if (document.pointerLockElement === document.body && !gameStarted) {
            startGame();
        }
    });
}

function getLaserFromPool() {
    // Try to reuse an inactive laser
    for (const laser of laserPool) {
        if (!laser.visible) {
            laser.visible = true;
            return laser;
        }
    }
    
    // Create a new laser if pool isn't full
    if (laserPool.length < MAX_LASERS) {
        const laserGeometry = new THREE.BoxGeometry(0.3, 0.3, 1);
        const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
        const newLaser = new THREE.Mesh(laserGeometry, laserMaterial);
        newLaser.visible = true;
        newLaser.name = "Laser_" + laserPool.length; // Give each laser a unique name
        scene.add(newLaser);
        laserPool.push(newLaser);
        return newLaser;
    }
    
    // Recycle oldest active laser
    const oldestLaser = lasers.shift();
    oldestLaser.visible = true;
    return oldestLaser;
}

function getFlashFromPool() {
    // Try to reuse an inactive flash
    for (const flash of flashPool) {
        if (!flash.visible) {
            flash.visible = true;
            return flash;
        }
    }
    
    // Create a new flash if pool isn't full
    if (flashPool.length < MAX_FLASHES) {
        const flashGeometry = new THREE.SphereGeometry(1.2, 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xff3232, transparent: true, opacity: 0.8 });
        const newFlash = new THREE.Mesh(flashGeometry, flashMaterial);
        newFlash.visible = false;
        newFlash.name = "Flash_" + flashPool.length; // Give each flash a unique name
        scene.add(newFlash);
        flashPool.push(newFlash);
        return newFlash;
    }
    
    // Recycle oldest flash
    const oldestFlash = flashPool[0];
    flashPool.splice(0, 1);
    flashPool.push(oldestFlash);
    return oldestFlash;
}

function preloadSounds() {
    // Create a pool of audio objects using imported sound URL
    for (let i = 0; i < MAX_SOUNDS; i++) {
        const sound = new Audio(laserSoundUrl);
        sound.load(); // Preload the sound
        sound.volume = 0.5; // Set appropriate volume
        soundPool.push({
            audio: sound,
            isPlaying: false
        });
    }
    soundsLoaded = true;
}

function shootLaser() {
    // Only allow shooting if game is in playing state
    if (!uiManager.isPlaying()) return;
    
    // Play sound from pool if available
    if (soundsLoaded) {
        // Find an available sound in the pool
        const availableSound = soundPool.find(s => !s.isPlaying);
        if (availableSound) {
            availableSound.isPlaying = true;
            availableSound.audio.currentTime = 0;
            availableSound.audio.play()
                .then(() => {
                    // Mark as available when playback ends
                    availableSound.audio.onended = () => {
                        availableSound.isPlaying = false;
                    };
                })
                .catch(e => {
                    console.warn('Could not play sound: ', e);
                    availableSound.isPlaying = false;
                });
        }
    }
    
    // Use ship's forward direction for shooting, not camera direction
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    
    // Start the ray from the player position
    const rayOrigin = player.position.clone();
    
    // Add a slight forward offset to avoid self-intersection
    rayOrigin.add(direction.clone().multiplyScalar(3));
    
    raycaster.set(rayOrigin, direction);
    
    // Get start position for the laser
    const startPos = rayOrigin.clone();
    
    // Check for intersections
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Create a list of objects to ignore (player and its children, lasers, orbit lines, flashes)
    const ignoreList = [player, ...player.children];
    
    // Add all active lasers to the ignore list
    laserPool.forEach(laser => {
        if (laser.visible) {
            ignoreList.push(laser);
        }
    });
    
    // Add all flash objects to the ignore list
    flashPool.forEach(flash => {
        ignoreList.push(flash);
    });
    
    // Add all orbit lines to the ignore list
    orbitLines.forEach(line => {
        ignoreList.push(line);
    });
    
    let targetPoint, targetObject, targetParent;
    if (intersects.length > 0) {
        // Filter out objects to ignore and anything too close to the player
        const filteredIntersects = intersects.filter(intersect => {
            // Check if the object is in the ignore list or its parent is
            const isIgnored = ignoreList.includes(intersect.object) || 
                             ignoreList.includes(intersect.object.parent);
            
            // Check if the object name contains "OrbitLine" (as a fallback)
            const isOrbitLine = intersect.object.name && intersect.object.name.includes("OrbitLine");
            
            // Check if the intersection point is too close to the player
            const distanceFromPlayer = player.position.distanceTo(intersect.point);
            const isTooClose = distanceFromPlayer < 6;
            
            // Only include intersections that are not ignored, not orbit lines, and not too close
            return !isIgnored && !isOrbitLine && !isTooClose;
        });
        
        if (filteredIntersects.length > 0) {
            // Hit something valid
            targetPoint = filteredIntersects[0].point;
            targetObject = filteredIntersects[0].object;
            
            // Find the parent group (sun, planet, or moon)
            if (targetObject.isInstancedMesh) {
                // If we hit an instanced mesh directly
                targetParent = targetObject.parent;
            } else {
                // Otherwise use the parent
                targetParent = targetObject.parent;
            }
        } else {
            // Nothing valid hit, shoot into distance
            targetPoint = startPos.clone().add(direction.clone().multiplyScalar(100));
            targetObject = null;
            targetParent = null;
        }
    } else {
        // Nothing hit, shoot into distance
        targetPoint = startPos.clone().add(direction.clone().multiplyScalar(100));
        targetObject = null;
        targetParent = null;
    }
    
    // Get a laser from the pool
    const laser = getLaserFromPool();
    
    // Calculate distance and set laser length
    const distance = startPos.distanceTo(targetPoint);
    laser.scale.z = distance;
    
    // Position laser
    laser.position.copy(startPos.clone().add(direction.clone().multiplyScalar(distance / 2)));
    laser.lookAt(targetPoint);
    
    // Set laser properties
    laser.life = 0.3;
    laser.target = targetObject;
    
    lasers.push(laser);
    
    // Create impact flash if hitting something
    if (targetObject) {
        const flash = getFlashFromPool();
        flash.position.copy(targetPoint);
        flash.visible = true;
        flash.name = "Flash"; // Add a name to help with identification
        
        // Hide flash after a short time
        setTimeout(() => {
            flash.visible = false;
        }, 200);
        
        // Create explosion
        if (targetParent && 
            (targetParent === sun || 
             planets.includes(targetParent) || 
             planets.some(p => p.moon && targetParent === p.moon))) {
            
            // Convert world coordinates to local coordinates for the explosion
            const localPoint = targetParent.worldToLocal(targetPoint.clone());
            
            setTimeout(() => {
                createExplosion(targetParent, localPoint);
            }, 300);
        }
    }
}

function createExplosion(parent, targetPos, radius = 1.5) {
    // If the parent doesn't have an instancedMesh, it's not a voxel-based object
    if (!parent.instancedMesh && !parent.ringInstancedMesh) {
        return;
    }
    
    // List of blocks to destroy (by index)
    const blocksToDestroy = [];
    
    // Check blocks in parent's blockDict
    if (parent.blockDict) {
        for (let x = Math.floor(targetPos.x - radius); x <= Math.ceil(targetPos.x + radius); x++) {
            for (let y = Math.floor(targetPos.y - radius); y <= Math.ceil(targetPos.y + radius); y++) {
                for (let z = Math.floor(targetPos.z - radius); z <= Math.ceil(targetPos.z + radius); z++) {
                    const key = `${x},${y},${z}`;
                    if (parent.blockDict[key] !== undefined) {
                        const blockIndex = parent.blockDict[key];
                        const blockPos = new THREE.Vector3(x, y, z);
                        const distance = blockPos.distanceTo(targetPos);
                        if (distance <= radius) {
                            blocksToDestroy.push(blockIndex);
                            delete parent.blockDict[key];
                        }
                    }
                }
            }
        }
    }
    
    // Check blocks in parent's ringDict (for Saturn's rings)
    if (parent.ringDict) {
        for (let x = Math.floor(targetPos.x - radius); x <= Math.ceil(targetPos.x + radius); x++) {
            for (let y = Math.floor(targetPos.y - radius); y <= Math.ceil(targetPos.y + radius); y++) {
                for (let z = Math.floor(targetPos.z - radius); z <= Math.ceil(targetPos.z + radius); z++) {
                    const key = `${x},${y},${z}`;
                    if (parent.ringDict[key] !== undefined) {
                        const blockIndex = parent.ringDict[key];
                        const blockPos = new THREE.Vector3(x, y, z);
                        const distance = blockPos.distanceTo(targetPos);
                        if (distance <= radius) {
                            blocksToDestroy.push(blockIndex);
                            delete parent.ringDict[key];
                        }
                    }
                }
            }
        }
    }
    
    // Hide destroyed blocks by moving them far away
    const matrix = new THREE.Matrix4();
    matrix.setPosition(1000, 1000, 1000); // Move far away
    
    // Apply to main instanced mesh
    if (parent.instancedMesh) {
        blocksToDestroy.forEach(index => {
            parent.instancedMesh.setMatrixAt(index, matrix);
        });
        
        if (blocksToDestroy.length > 0) {
            parent.instancedMesh.instanceMatrix.needsUpdate = true;
        }
    }
    
    // Apply to ring instanced mesh if it exists
    if (parent.ringInstancedMesh) {
        blocksToDestroy.forEach(index => {
            parent.ringInstancedMesh.setMatrixAt(index, matrix);
        });
        
        if (blocksToDestroy.length > 0) {
            parent.ringInstancedMesh.instanceMatrix.needsUpdate = true;
        }
    }
}

function handleMovement(delta) {
    // Only move if game is active and player exists
    if (!uiManager.isPlaying() || !player) return;
    
    // Always move forward in the direction the ship is facing
    const forwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    player.position.add(forwardDirection.multiplyScalar(SHIP_SPEED * delta));
    
    // Handle turning with smooth rotation
    let targetYawChange = 0;
    let targetPitchChange = 0;
    let targetRollChange = 0;
    
    // Yaw (left/right turning)
    if (keyboard['KeyA'] || keyboard['ArrowLeft']) {
        targetYawChange = SHIP_TURN_SPEED * delta;
        // Allow continuous rolling when turning left
        targetRollChange = SHIP_ROLL_SPEED * delta;
    } else if (keyboard['KeyD'] || keyboard['ArrowRight']) {
        targetYawChange = -SHIP_TURN_SPEED * delta;
        // Allow continuous rolling when turning right
        targetRollChange = -SHIP_ROLL_SPEED * delta;
    } else {
        // Return roll to neutral when not turning, but only if within a small range
        // This allows the ship to stay rolled if the player has done a full roll
        const normalizedRoll = ((player.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        
        if (normalizedRoll > 0.1 && normalizedRoll < Math.PI) {
            // If between 0 and PI, roll clockwise toward 0
            targetRollChange = -SHIP_ROLL_SPEED * delta;
        } else if (normalizedRoll > Math.PI && normalizedRoll < Math.PI * 2 - 0.1) {
            // If between PI and 2*PI, roll counter-clockwise toward 0
            targetRollChange = SHIP_ROLL_SPEED * delta;
        }
    }
    
    // Pitch (up/down) - now allowing for complete loops
    if (keyboard['KeyW'] || keyboard['ArrowUp']) {
        targetPitchChange = -SHIP_PITCH_SPEED * delta;
    } else if (keyboard['KeyS'] || keyboard['ArrowDown']) {
        targetPitchChange = SHIP_PITCH_SPEED * delta;
    } else {
        // Auto-level pitch when not pressing up/down, but only if within a small range
        // This allows the ship to stay in its orientation if the player has done a loop
        const normalizedPitch = ((player.rotation.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        
        if (normalizedPitch > 0.1 && normalizedPitch < Math.PI) {
            // If between 0 and PI, pitch down toward 0
            targetPitchChange = -SHIP_PITCH_SPEED * delta * 0.5; // Slower auto-leveling
        } else if (normalizedPitch > Math.PI && normalizedPitch < Math.PI * 2 - 0.1) {
            // If between PI and 2*PI, pitch up toward 0
            targetPitchChange = SHIP_PITCH_SPEED * delta * 0.5; // Slower auto-leveling
        }
    }
    
    // Apply rotations to the ship
    player.rotation.y += targetYawChange;
    
    // Apply pitch without limiting it, allowing for full 360° loops
    player.rotation.x += targetPitchChange;
    
    // Apply roll without limiting it, allowing for full 360° rolls
    player.rotation.z += targetRollChange;
    
    // Update camera position
    updateCameraPosition();
}

function updatePlanets(delta) {
    // Update planet positions
    planets.forEach(planet => {
        planet.orbitAngle += planet.orbitSpeed * delta;
        planet.position.x = Math.cos(planet.orbitAngle) * planet.orbitRadius;
        planet.position.z = Math.sin(planet.orbitAngle) * planet.orbitRadius;
        
        // Update moon if this planet has one
        if (planet.moon) {
            planet.moon.rotationAngle += planet.moon.rotationSpeed * delta;
            planet.moon.position.x = Math.cos(planet.moon.rotationAngle) * 5;
            planet.moon.position.z = Math.sin(planet.moon.rotationAngle) * 5;
        }
    });
}

function updateLasers(delta) {
    // Update lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        laser.life -= delta;
        
        if (laser.life <= 0) {
            laser.visible = false;
            lasers.splice(i, 1);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    // Get delta time from Three.js clock
    const delta = clock.getDelta();
    
    // Only handle player movement if game is in playing state
    if (uiManager.isPlaying()) {
        // Handle player movement
        handleMovement(delta);
        
        // Update camera position only if we're not in a menu animation
        if (!window.cameraAnimating) {
            updateCameraPosition();
        }
    }
    
    // Update planet positions
    updatePlanets(delta);
    
    // Update lasers
    updateLasers(delta);
    
    // Render the scene
    renderer.render(scene, camera);
}

// Create player function
function createPlayer() {
    // Create a group to hold all spaceship parts
    player = new THREE.Group();
    player.position.set(0, 20, 70);
    player.rotation.order = 'YXZ'; // Set rotation order to match camera
    
    // Initialize camera offset angles
    cameraOffset.angles = { yaw: 0, pitch: 0 };
    
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc }); // Blue body
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 }); // Gray wings
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333 }); // Red accents
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x66ccff, 
        transparent: true, 
        opacity: 0.7 
    }); // Transparent blue cockpit
    
    // Main body - slightly elongated
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    player.add(body);
    
    // Cockpit - on top front
    const cockpitGeometry = new THREE.BoxGeometry(1, 0.7, 1.2);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.8, -0.8);
    player.add(cockpit);
    
    // Wings - on sides
    const wingGeometry = new THREE.BoxGeometry(4, 0.3, 2);
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-2, -0.2, 0);
    player.add(leftWing);
    
    // Right wing
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(2, -0.2, 0);
    player.add(rightWing);
    
    // Engine blocks - at the back
    const engineGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    
    // Left engine
    const leftEngine = new THREE.Mesh(engineGeometry, accentMaterial);
    leftEngine.position.set(-0.8, -0.1, 1.8);
    player.add(leftEngine);
    
    // Right engine
    const rightEngine = new THREE.Mesh(engineGeometry, accentMaterial);
    rightEngine.position.set(0.8, -0.1, 1.8);
    player.add(rightEngine);
    
    // Forward gun/cannon
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
    
    scene.add(player);
}

// Update camera position based on player position and rotation
function updateCameraPosition() {
    if (!player) return; // Don't update if player doesn't exist
    
    // Create a base offset that follows the ship's orientation
    // Increased Z from 10 to 15 to move camera further back
    // Increased Y from 3 to 4 to raise camera slightly for better view
    const baseOffset = new THREE.Vector3(0, 4, 15);
    baseOffset.applyQuaternion(player.quaternion);
    
    // Apply additional camera rotation based on mouse movement
    if (cameraOffset.angles) {
        // Create a rotation matrix for the additional camera rotation
        const rotationMatrix = new THREE.Matrix4();
        
        // First rotate around Y axis (yaw)
        rotationMatrix.makeRotationY(cameraOffset.angles.yaw);
        
        // Then rotate around X axis (pitch)
        const pitchMatrix = new THREE.Matrix4();
        pitchMatrix.makeRotationX(cameraOffset.angles.pitch);
        rotationMatrix.multiply(pitchMatrix);
        
        // Apply the rotation to the base offset
        baseOffset.applyMatrix4(rotationMatrix);
    }
    
    // Set camera position
    camera.position.copy(player.position).add(baseOffset);
    
    // Instead of looking at the player or far ahead, look at a point slightly above the player
    // Increased Z from -20 to -30 to look further ahead
    const lookOffset = new THREE.Vector3(0, 2, -30);
    lookOffset.applyQuaternion(player.quaternion);
    
    // Apply the same camera rotation to the look target
    if (cameraOffset.angles) {
        const rotationMatrix = new THREE.Matrix4();
        
        rotationMatrix.makeRotationY(cameraOffset.angles.yaw);
        const pitchMatrix = new THREE.Matrix4();
        pitchMatrix.makeRotationX(cameraOffset.angles.pitch);
        rotationMatrix.multiply(pitchMatrix);
        
        lookOffset.applyMatrix4(rotationMatrix);
    }
    
    const lookTarget = player.position.clone().add(lookOffset);
    camera.lookAt(lookTarget);
}

// New function to start the game
function startGame() {
    console.log("Starting game...");
    gameStarted = true;
    
    // Create player now that game is starting
    createPlayer();
    
    // Update camera position to follow player
    updateCameraPosition();
    
    // If connected to server, send player ready event
    if (socket && isConnected) {
      socket.emit('playerReady', { roomId });
    }
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
    if (socket && isConnected) {
        socket.emit('playerNotReady', { roomId });
    }
}

// Initialize the game when the window loads
window.addEventListener('load', function() {
    console.log("Window loaded, initializing game...");
    init();
});