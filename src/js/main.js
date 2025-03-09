import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

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
let mouse;
let leftMouseHeld = false;
let timeSinceLastShot = 0;
const AUTO_FIRE_DELAY = 0.3;
let cursorLocked = false;
let player; // Player object
let cameraOffset = new THREE.Vector3(0, 10, 20); // Much higher and further back
let orbitLines = []; // Store references to orbit lines

// Textures
const textures = {};
const textureLoader = new THREE.TextureLoader();

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

// Planet data: name, size, orbit_radius, orbit_speed
const planetData = [
    { name: 'Mercury', size: 1, orbitRadius: 12, orbitSpeed: 0.04 * 3 * 4 },
    { name: 'Venus', size: 2, orbitRadius: 16, orbitSpeed: 0.015 * 3 * 4 },
    { name: 'Earth', size: 2, orbitRadius: 22, orbitSpeed: 0.01 * 3 * 4 },
    { name: 'Mars', size: 1.5, orbitRadius: 28, orbitSpeed: 0.008 * 3 * 4 },
    { name: 'Jupiter', size: 4, orbitRadius: 40, orbitSpeed: 0.002 * 3 * 4 },
    { name: 'Saturn', size: 3.5, orbitRadius: 55, orbitSpeed: 0.0015 * 3 * 4 },
    { name: 'Uranus', size: 3, orbitRadius: 70, orbitSpeed: 0.001 * 3 * 4 },
    { name: 'Neptune', size: 3, orbitRadius: 85, orbitSpeed: 0.0008 * 3 * 4 }
];

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Create player
    createPlayer();
    
    // Position camera behind player
    updateCameraPosition();

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
    mouse = new THREE.Vector2();

    // Setup event listeners
    setupEventListeners();
    
    // Setup controls
    setupControls();

    // Add an initial direction helper
    addDirectionHelper();

    // Start animation loop
    animate();
    
    console.log("Game initialized successfully");
}

function loadStarsTexture() {
    // Only load the stars texture for skybox
    textures['stars'] = textureLoader.load(
        `./js/textures/stars.png`,
        undefined,
        undefined,
        () => {
            console.warn(`Could not load stars texture, using fallback color`);
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = `#${celestialColors.stars.toString(16).padStart(6, '0')}`;
            ctx.fillRect(0, 0, 128, 128);
            
            const fallbackTexture = new THREE.CanvasTexture(canvas);
            textures['stars'] = fallbackTexture;
        }
    );
}

function createSkybox() {
    const skyGeometry = new THREE.BoxGeometry(500, 500, 500);
    const skyMaterials = Array(6).fill().map(() => {
        return new THREE.MeshBasicMaterial({
            map: textures['stars'],
            side: THREE.BackSide
        });
    });
    
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
    // We're not using PointerLockControls anymore
    // Instead, we'll handle player movement and rotation manually
    
    // Setup pointer lock change event
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
        document.getElementById('crosshair').style.display = 'block';
        // Hide instructions when cursor is locked
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.classList.add('hidden');
        }
    } else {
        // Pointer is unlocked
        cursorLocked = false;
        document.getElementById('crosshair').style.display = 'none';
        // Show instructions when cursor is unlocked
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.classList.remove('hidden');
        }
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
    
    // Create voxel-based sun with emissive material to make it glow
    for (let x = -5; x <= 5; x++) {
        for (let y = -5; y <= 5; y++) {
            for (let z = -5; z <= 5; z++) {
                if (x*x + y*y + z*z <= 25) {
                    const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
                    const voxelMaterial = new THREE.MeshStandardMaterial({ 
                        color: celestialColors.sun,
                        emissive: 0xffff00,
                        emissiveIntensity: 0.5
                    });
                    const voxel = new THREE.Mesh(voxelGeometry, voxelMaterial);
                    
                    voxel.position.set(x, y, z);
                    sun.add(voxel);
                    
                    // Store voxel in dictionary with position as key
                    sun.blockDict[`${x},${y},${z}`] = voxel;
                }
            }
        }
    }
    
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
        
        // Create voxel-based planet
        for (let x = -voxelRange; x <= voxelRange; x++) {
            for (let y = -voxelRange; y <= voxelRange; y++) {
                for (let z = -voxelRange; z <= voxelRange; z++) {
                    if (x*x + y*y + z*z <= maxDistance) {
                        // Determine if this is an outer block
                        let isOuterBlock = false;
                        for (const [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                            const nx = x + dx;
                            const ny = y + dy;
                            const nz = z + dz;
                            if (nx*nx + ny*ny + nz*nz > maxDistance) {
                                isOuterBlock = true;
                                break;
                            }
                        }
                        
                        // Select color and emission color based on planet type
                        let voxelColor;
                        let emissiveColor;
                        
                        if (data.name === 'Earth') {
                            // Earth special case
                            voxelColor = Math.random() < 0.7 ? celestialColors.earthWater : celestialColors.earthLand;
                            emissiveColor = Math.random() < 0.7 ? 0x0033ff : 0x00ff33; // Blue or green glow
                        } else if (data.name === 'Jupiter') {
                            // Jupiter banded appearance
                            const band = (y + voxelRange) % 3;
                            if (band === 0) {
                                voxelColor = celestialColors.jupiterOrange;
                                emissiveColor = 0xff8800;
                            } else if (band === 1) {
                                voxelColor = celestialColors.jupiterYellow;
                                emissiveColor = 0xffff00;
                            } else {
                                voxelColor = celestialColors.jupiterRed;
                                emissiveColor = 0xff4400;
                            }
                        } else if (data.name === 'Saturn') {
                            // Saturn banded appearance
                            const band = (y + voxelRange) % 2;
                            voxelColor = band === 0 ? celestialColors.saturnYellow : celestialColors.saturnOrange;
                            emissiveColor = band === 0 ? 0xffff00 : 0xff8800;
                        } else if (data.name === 'Venus') {
                            // Venus cloud patterns
                            const patternValue = (x + y + z) % 4;
                            if (patternValue === 0) {
                                voxelColor = celestialColors.saturnYellow;
                                emissiveColor = 0xffff00;
                            } else if (patternValue === 1) {
                                voxelColor = celestialColors.jupiterOrange;
                                emissiveColor = 0xff8800;
                            } else if (patternValue === 2) {
                                voxelColor = celestialColors.saturnYellow;
                                emissiveColor = 0xffffaa;
                            } else {
                                voxelColor = celestialColors.moon;
                                emissiveColor = 0xffffff;
                            }
                        } else if (data.name === 'Mars') {
                            voxelColor = celestialColors.mars;
                            emissiveColor = 0xff4400;
                        } else if (data.name === 'Mercury') {
                            voxelColor = celestialColors.mercury;
                            emissiveColor = 0x888888;
                        } else if (data.name === 'Uranus') {
                            voxelColor = celestialColors.uranus;
                            emissiveColor = 0x00ccff;
                        } else if (data.name === 'Neptune') {
                            voxelColor = celestialColors.neptune;
                            emissiveColor = 0x0066ff;
                        }
                        
                        const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
                        const voxelMaterial = new THREE.MeshStandardMaterial({ 
                            color: voxelColor,
                            emissive: emissiveColor,  // Add emissive glow to planets
                            emissiveIntensity: 0.3    // Not as bright as the sun
                        });
                        const voxel = new THREE.Mesh(voxelGeometry, voxelMaterial);
                        
                        voxel.position.set(x, y, z);
                        planet.add(voxel);
                        
                        // Store voxel in dictionary
                        planet.blockDict[`${x},${y},${z}`] = voxel;
                    }
                }
            }
        }
        
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
    const ringRadius = 6;
    const ringThickness = 0.5;
    
    planet.ringDict = {};
    
    // Create flat disc for rings
    for (let x = -ringRadius; x <= ringRadius; x++) {
        for (let z = -ringRadius; z <= ringRadius; z++) {
            const distanceFromCenter = Math.sqrt(x*x + z*z);
            if (4 <= distanceFromCenter && distanceFromCenter <= ringRadius) {
                const voxelGeometry = new THREE.BoxGeometry(1, ringThickness, 1);
                const voxelMaterial = new THREE.MeshStandardMaterial({ 
                    color: celestialColors.saturnOrange,
                    emissive: 0xff8800,  // Make rings glow orange
                    emissiveIntensity: 0.3
                });
                const ringVoxel = new THREE.Mesh(voxelGeometry, voxelMaterial);
                
                ringVoxel.position.set(x, 0, z);
                planet.add(ringVoxel);
                
                // Store ring voxel in dictionary
                planet.ringDict[`${x},0,${z}`] = ringVoxel;
            }
        }
    }
}

function createMoon() {
    // Find Earth
    const earth = planets.find(planet => planet.name === 'Earth');
    
    if (earth) {
        const moon = new THREE.Group();
        moon.name = 'Moon';
        moon.parent = earth;
        moon.position.set(5, 0, 0);
        moon.rotationSpeed = 0.08; // Already increased from 0.02 to 0.08 (4x faster)
        moon.rotationAngle = 0;
        moon.blockDict = {};
        
        const moonSize = 0.7;
        const moonVoxelRange = Math.floor(moonSize) + 1;
        const moonMaxDistance = moonSize * moonSize;
        
        // Create voxel-based moon
        for (let x = -moonVoxelRange; x <= moonVoxelRange; x++) {
            for (let y = -moonVoxelRange; y <= moonVoxelRange; y++) {
                for (let z = -moonVoxelRange; z <= moonVoxelRange; z++) {
                    if (x*x + y*y + z*z <= moonMaxDistance) {
                        // Determine if outer block
                        let isOuterBlock = false;
                        for (const [dx, dy, dz] of [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) {
                            const nx = x + dx;
                            const ny = y + dy;
                            const nz = z + dz;
                            if (nx*nx + ny*ny + nz*nz > moonMaxDistance) {
                                isOuterBlock = true;
                                break;
                            }
                        }
                        
                        const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
                        const voxelMaterial = new THREE.MeshStandardMaterial({ 
                            color: celestialColors.moon,
                            emissive: 0xaaaaaa,       // Soft white glow
                            emissiveIntensity: 0.2    // Slightly dimmer than planets
                        });
                        const voxel = new THREE.Mesh(voxelGeometry, voxelMaterial);
                        
                        voxel.position.set(x, y, z);
                        moon.add(voxel);
                        
                        // Store voxel in dictionary
                        moon.blockDict[`${x},${y},${z}`] = voxel;
                    }
                }
            }
        }
        
        earth.add(moon);
        earth.moon = moon;
    }
}

function setupEventListeners() {
    // Keyboard event listeners
    document.addEventListener('keydown', (event) => {
        keyboard[event.code] = true;
        
        // Toggle cursor lock with 'P' key
        if (event.code === 'KeyP') {
            if (cursorLocked) {
                document.exitPointerLock = document.exitPointerLock || 
                                          document.mozExitPointerLock ||
                                          document.webkitExitPointerLock;
                document.exitPointerLock();
            } else {
                document.body.requestPointerLock = document.body.requestPointerLock || 
                                                  document.body.mozRequestPointerLock ||
                                                  document.body.webkitRequestPointerLock;
                document.body.requestPointerLock();
            }
        }
        
        // Quit with Escape key
        if (event.code === 'Escape') {
            // In a web context, we can't truly "quit", but we can unlock controls
            document.exitPointerLock = document.exitPointerLock || 
                                      document.mozExitPointerLock ||
                                      document.webkitExitPointerLock;
            document.exitPointerLock();
        }
    });
    
    document.addEventListener('keyup', (event) => {
        keyboard[event.code] = false;
    });
    
    // Mouse event listeners
    document.addEventListener('mousedown', (event) => {
        if (event.button === 0 && cursorLocked) { // Left mouse button and cursor is locked
            leftMouseHeld = true;
            shootLaser();
        }
    });
    
    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) {
            leftMouseHeld = false;
        }
    });
    
    // Mouse movement for camera rotation
    document.addEventListener('mousemove', (event) => {
        if (cursorLocked) {
            // Rotate player based on mouse movement
            player.rotation.y -= event.movementX * 0.002;
            
            // Limit vertical rotation to prevent flipping
            const verticalRotation = player.rotation.x + event.movementY * 0.002;
            player.rotation.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, verticalRotation));
            
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

function shootLaser() {
    // Play sound if available, otherwise skip it
    try {
        const shootSound = new Audio('./js/textures/shoot.mp3');
        shootSound.currentTime = 1.1;
        shootSound.play().catch(e => {
            console.warn('Could not play shoot sound: ', e);
        });
    } catch (e) {
        console.warn('Error with audio: ', e);
    }
    
    // Create the ray from a position much further in front of the player
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(player.quaternion);
    
    // Start the ray 5 units in front of the player to completely avoid self-intersection
    const rayOrigin = player.position.clone().add(direction.clone().multiplyScalar(5));
    
    // Add a slight upward offset to the ray origin to avoid hitting the player from above
    rayOrigin.y += 1;
    
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
    
    let targetPoint, targetObject;
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
        } else {
            // Nothing valid hit, shoot into distance
            targetPoint = startPos.clone().add(direction.clone().multiplyScalar(100));
            targetObject = null;
        }
    } else {
        // Nothing hit, shoot into distance
        targetPoint = startPos.clone().add(direction.clone().multiplyScalar(100));
        targetObject = null;
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
        if (targetObject.parent && 
            (targetObject.parent === sun || 
             planets.includes(targetObject.parent) || 
             planets.some(p => p.moon && targetObject.parent === p.moon))) {
            setTimeout(() => {
                createExplosion(targetObject);
            }, 300);
        }
    }
}

function createExplosion(targetObject, radius = 1.5) {
    // Get the parent entity (planet, sun, or moon)
    const parent = targetObject.parent;
    
    // Get the position of the target in local space
    const targetPos = targetObject.position.clone();
    
    // List of blocks to destroy
    const blocksToDestroy = [];
    
    // Check blocks in parent's blockDict
    if (parent.blockDict) {
        for (let x = Math.floor(targetPos.x - radius); x <= Math.ceil(targetPos.x + radius); x++) {
            for (let y = Math.floor(targetPos.y - radius); y <= Math.ceil(targetPos.y + radius); y++) {
                for (let z = Math.floor(targetPos.z - radius); z <= Math.ceil(targetPos.z + radius); z++) {
                    const key = `${x},${y},${z}`;
                    if (parent.blockDict[key]) {
                        const block = parent.blockDict[key];
                        const distance = block.position.distanceTo(targetPos);
                        if (distance <= radius) {
                            blocksToDestroy.push(block);
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
                    if (parent.ringDict[key]) {
                        const block = parent.ringDict[key];
                        const distance = block.position.distanceTo(targetPos);
                        if (distance <= radius) {
                            blocksToDestroy.push(block);
                            delete parent.ringDict[key];
                        }
                    }
                }
            }
        }
    }
    
    // Destroy all blocks
    blocksToDestroy.forEach(block => {
        parent.remove(block);
    });
}

function handleMovement(delta) {
    const moveSpeed = 20 * delta;
    
    if (cursorLocked) {
        // Create a direction vector
        const direction = new THREE.Vector3();
        
        // Forward/backward movement
        if (keyboard['KeyW'] || keyboard['ArrowUp']) {
            direction.z = -1;
        } else if (keyboard['KeyS'] || keyboard['ArrowDown']) {
            direction.z = 1;
        }
        
        // Left/right movement
        if (keyboard['KeyA'] || keyboard['ArrowLeft']) {
            direction.x = -1;
        } else if (keyboard['KeyD'] || keyboard['ArrowRight']) {
            direction.x = 1;
        }
        
        // Normalize the direction vector to prevent faster diagonal movement
        if (direction.length() > 0) {
            direction.normalize();
            
            // Apply player's rotation to the direction
            direction.applyQuaternion(player.quaternion);
            
            // Move player
            player.position.add(direction.multiplyScalar(moveSpeed));
        }
        
        // Up/down movement
        if (keyboard['Space']) {
            player.position.y += moveSpeed;
        }
        if (keyboard['ShiftLeft'] || keyboard['ShiftRight']) {
            player.position.y -= moveSpeed;
        }
        
        // Update camera position
        updateCameraPosition();
    }
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

function handleAutoFire(delta) {
    // Auto-fire when holding left mouse button
    if (leftMouseHeld && cursorLocked) {
        timeSinceLastShot += delta;
        if (timeSinceLastShot >= AUTO_FIRE_DELAY) {
            timeSinceLastShot = 0;
            shootLaser();
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = 1/60; // Fixed timestep for consistent behavior
    
    // Handle player movement
    handleMovement(delta);
    
    // Update planet positions
    updatePlanets(delta);
    
    // Update lasers
    updateLasers(delta);
    
    // Handle auto-fire
    handleAutoFire(delta);
    
    // Render the scene
    renderer.render(scene, camera);
}

// Add temporary direction helper function
function addDirectionHelper() {
    // Function is now empty - no direction helper text will be displayed
}

// Create player function
function createPlayer() {
    // Create a simple gray block for the player
    const playerGeometry = new THREE.BoxGeometry(2, 2, 2);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, 20, 70); // Much lower position
    player.rotation.order = 'YXZ'; // Set rotation order to match camera
    scene.add(player);
    
    // Add a small indicator to show which way is forward
    const indicatorGeometry = new THREE.BoxGeometry(0.5, 0.5, 1);
    const indicatorMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.position.set(0, 0, -1.5); // Position it at the front of the player
    player.add(indicator);
}

// Update camera position based on player position and rotation
function updateCameraPosition() {
    // Calculate camera position based on player position and rotation
    const offset = cameraOffset.clone();
    offset.applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(offset);
    
    // Make camera look at a point far in front of the player to improve aiming
    // This creates a better alignment between the crosshair and where shots will go
    const lookTarget = player.position.clone().add(
        new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion).multiplyScalar(50)
    );
    camera.lookAt(lookTarget);
}

// Initialize the game when the window loads
window.addEventListener('load', function() {
    console.log("Window loaded, initializing game...");
    init();
});