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

// Textures
const textures = {};
const textureLoader = new THREE.TextureLoader();

// Fallback colors for textures
const fallbackColors = {
    'orange.png': 0xff8800,
    'yellow.png': 0xffff00,
    'grass.png': 0x00ff00,
    'water.png': 0x0000ff,
    'red.png': 0xff0000,
    'light_blue.png': 0x88ccff,
    'jupiter.png': 0xff9933,
    'white.png': 0xffffff,
    'gray.png': 0x888888,
    'stars.png': 0x222244,
    'sun.png': 0xffff88
};

// Keyboard state
const keyboard = {};

// Planet data: name, texture, size, orbit_radius, orbit_speed
const planetData = [
    { name: 'Mercury', texture: 'gray.png', size: 1, orbitRadius: 12, orbitSpeed: 0.04 * 3 * 4 },
    { name: 'Venus', texture: 'yellow.png', size: 2, orbitRadius: 16, orbitSpeed: 0.015 * 3 * 4 },
    { name: 'Earth', texture: 'mixed', size: 2, orbitRadius: 22, orbitSpeed: 0.01 * 3 * 4 },
    { name: 'Mars', texture: 'red.png', size: 1.5, orbitRadius: 28, orbitSpeed: 0.008 * 3 * 4 },
    { name: 'Jupiter', texture: 'jupiter.png', size: 4, orbitRadius: 40, orbitSpeed: 0.002 * 3 * 4 },
    { name: 'Saturn', texture: 'yellow.png', size: 3.5, orbitRadius: 55, orbitSpeed: 0.0015 * 3 * 4 },
    { name: 'Uranus', texture: 'light_blue.png', size: 3, orbitRadius: 70, orbitSpeed: 0.001 * 3 * 4 },
    { name: 'Neptune', texture: 'water.png', size: 3, orbitRadius: 85, orbitSpeed: 0.0008 * 3 * 4 }
];

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 30, 70); // Move higher and further out to see more planets at once
    camera.lookAt(0, 0, 0); // Look at the center of the solar system

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Load textures (only for skybox)
    loadTextures();

    // Create skybox with stars
    createSkybox();

    // Setup lighting
    setupLighting();

    // Create first-person controls
    setupControls();

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

    // Add an initial direction helper
    addDirectionHelper();

    // Start animation loop
    animate();
}

function loadTextures() {
    // Only load the stars texture for skybox
    textures['stars.png'] = textureLoader.load(
        `./js/textures/stars.png`,
        undefined,
        undefined,
        () => {
            console.warn(`Could not load texture: stars.png, using fallback color`);
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = `#${fallbackColors['stars.png'].toString(16).padStart(6, '0')}`;
            ctx.fillRect(0, 0, 128, 128);
            
            const fallbackTexture = new THREE.CanvasTexture(canvas);
            textures['stars.png'] = fallbackTexture;
        }
    );
}

// Create a texture from a fallback color
function createColorTexture(colorName) {
    const color = fallbackColors[colorName];
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 128, 128);
    
    return new THREE.CanvasTexture(canvas);
}

function createSkybox() {
    const skyGeometry = new THREE.BoxGeometry(500, 500, 500);
    const skyMaterials = Array(6).fill().map(() => {
        return new THREE.MeshBasicMaterial({
            map: textures['stars.png'],
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
    controls = new PointerLockControls(camera, document.body);
    
    // Add event listener for locking/unlocking the pointer
    document.addEventListener('click', () => {
        if (!cursorLocked) {
            controls.lock();
        }
    });
    
    controls.addEventListener('lock', () => {
        cursorLocked = true;
        document.getElementById('crosshair').style.display = 'block';
        // Hide instructions when cursor is locked
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.classList.add('hidden');
        }
    });
    
    controls.addEventListener('unlock', () => {
        cursorLocked = false;
        document.getElementById('crosshair').style.display = 'none';
        // Show instructions when cursor is unlocked
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.classList.remove('hidden');
        }
    });
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
    
    // Create a color texture for the sun
    const sunColor = fallbackColors['sun.png'];
    
    // Create voxel-based sun with emissive material to make it glow
    for (let x = -5; x <= 5; x++) {
        for (let y = -5; y <= 5; y++) {
            for (let z = -5; z <= 5; z++) {
                if (x*x + y*y + z*z <= 25) {
                    const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
                    const voxelMaterial = new THREE.MeshStandardMaterial({ 
                        color: sunColor,
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
                        
                        if (data.texture === 'mixed') {
                            // Earth special case
                            voxelColor = Math.random() < 0.7 ? fallbackColors['water.png'] : fallbackColors['grass.png'];
                            emissiveColor = Math.random() < 0.7 ? 0x0033ff : 0x00ff33; // Blue or green glow
                        } else if (data.name === 'Jupiter') {
                            // Jupiter banded appearance
                            const band = (y + voxelRange) % 3;
                            if (band === 0) {
                                voxelColor = fallbackColors['orange.png'];
                                emissiveColor = 0xff8800;
                            } else if (band === 1) {
                                voxelColor = fallbackColors['yellow.png'];
                                emissiveColor = 0xffff00;
                            } else {
                                voxelColor = fallbackColors['red.png'];
                                emissiveColor = 0xff4400;
                            }
                        } else if (data.name === 'Saturn') {
                            // Saturn banded appearance
                            const band = (y + voxelRange) % 2;
                            voxelColor = band === 0 ? fallbackColors['yellow.png'] : fallbackColors['orange.png'];
                            emissiveColor = band === 0 ? 0xffff00 : 0xff8800;
                        } else if (data.name === 'Venus') {
                            // Venus cloud patterns
                            const patternValue = (x + y + z) % 4;
                            if (patternValue === 0) {
                                voxelColor = fallbackColors['yellow.png'];
                                emissiveColor = 0xffff00;
                            } else if (patternValue === 1) {
                                voxelColor = fallbackColors['orange.png'];
                                emissiveColor = 0xff8800;
                            } else if (patternValue === 2) {
                                voxelColor = fallbackColors['yellow.png'];
                                emissiveColor = 0xffffaa;
                            } else {
                                voxelColor = fallbackColors['white.png'];
                                emissiveColor = 0xffffff;
                            }
                        } else if (data.name === 'Mars') {
                            voxelColor = fallbackColors['red.png'];
                            emissiveColor = 0xff4400;
                        } else if (data.name === 'Mercury') {
                            voxelColor = fallbackColors['gray.png'];
                            emissiveColor = 0x888888;
                        } else if (data.name === 'Uranus') {
                            voxelColor = fallbackColors['light_blue.png'];
                            emissiveColor = 0x00ccff;
                        } else if (data.name === 'Neptune') {
                            voxelColor = fallbackColors['water.png'];
                            emissiveColor = 0x0066ff;
                        } else {
                            voxelColor = fallbackColors[data.texture];
                            emissiveColor = 0xffffff;
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
        scene.add(orbitLine);
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
                    color: fallbackColors['orange.png'],
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
                            color: fallbackColors['white.png'],
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
                controls.unlock();
            } else {
                controls.lock();
            }
        }
        
        // Quit with Escape key
        if (event.code === 'Escape') {
            // In a web context, we can't truly "quit", but we can unlock controls
            controls.unlock();
        }
    });
    
    document.addEventListener('keyup', (event) => {
        keyboard[event.code] = false;
    });
    
    // Mouse event listeners
    document.addEventListener('mousedown', (event) => {
        if (event.button === 0) { // Left mouse button
            leftMouseHeld = true;
            if (cursorLocked) {
                shootLaser();
            }
        }
    });
    
    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) {
            leftMouseHeld = false;
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
    
    // Create the ray from camera
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    // Get direction and start position
    const startPos = camera.position.clone();
    const direction = raycaster.ray.direction.clone();
    
    // Check for intersections
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    let targetPoint, targetObject;
    if (intersects.length > 0) {
        // Hit something
        targetPoint = intersects[0].point;
        targetObject = intersects[0].object;
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
        // Forward/backward movement
        if (keyboard['KeyW'] || keyboard['ArrowUp']) {
            controls.moveForward(moveSpeed);
        }
        if (keyboard['KeyS'] || keyboard['ArrowDown']) {
            controls.moveForward(-moveSpeed);
        }
        
        // Left/right movement
        if (keyboard['KeyA'] || keyboard['ArrowLeft']) {
            controls.moveRight(-moveSpeed);
        }
        if (keyboard['KeyD'] || keyboard['ArrowRight']) {
            controls.moveRight(moveSpeed);
        }
        
        // Up/down movement (custom implementation since PointerLockControls doesn't include this)
        if (keyboard['Space']) {
            camera.position.y += moveSpeed;
        }
        if (keyboard['ShiftLeft'] || keyboard['ShiftRight']) {
            camera.position.y -= moveSpeed;
        }
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
    // Create text to help find planets
    const helpText = document.createElement('div');
    helpText.style.position = 'absolute';
    helpText.style.bottom = '20px';
    helpText.style.left = '20px';
    helpText.style.color = 'white';
    helpText.style.fontFamily = 'Arial, sans-serif';
    helpText.style.fontSize = '16px';
    helpText.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    helpText.style.padding = '10px';
    helpText.style.borderRadius = '5px';
    helpText.innerHTML = 'Look toward the center (0,0,0).<br>Try using WASD to move around.<br>The sun is at the center with planets orbiting around it.';
    document.body.appendChild(helpText);
    
    // Auto-hide after 15 seconds
    setTimeout(() => {
        helpText.style.opacity = '0';
        helpText.style.transition = 'opacity 1s';
        setTimeout(() => {
            helpText.remove();
        }, 1000);
    }, 15000);
}

// Initialize the game when the window loads
window.addEventListener('load', init);