import * as THREE from 'three';
import { createExplosion } from './celestialBodies.js';

// Constants
export const MAX_LASERS = 20;
export const MAX_FLASHES = 10;

// Cached array of objects to test with raycaster
let cachedObjectsToTest = [];

// Ship type to laser color mapping
const SHIP_LASER_COLORS = {
    'default': 0xff3333,         // Red for default ship
    'Flowers Ship': 0x333333,    // Updated to dark gray (black) for Flowers ship
    'Angel Ship': 0xffd700,      // Gold for Angel ship
    'Chris Ship': 0x3366cc       // Blue for Chris ship
};

// Shared resources for all lasers and flashes
let sharedLaserGeometry;
let sharedFlashGeometry;
let laserMaterials = {};  // Materials keyed by color hex
let flashMaterials = {};  // Materials keyed by color hex

// *** NEW: Create audioSystem instance here ***
export let audioSystem = null; 

// Function to update the cached raycast targets
export function updateRaycastTargets(sun, planets) {
    cachedObjectsToTest = [];
    
    // Include sun
    if (sun) cachedObjectsToTest.push(sun);
    
    // Include planets and moons
    if (planets && planets.length) {
        planets.forEach(planet => {
            cachedObjectsToTest.push(planet);
            // Include moon if the planet has one
            if (planet.moon) cachedObjectsToTest.push(planet.moon);
        });
    }
}

// Initialize weapon systems
export function initWeapons(scene) {
    const laserPool = [];
    const lasers = [];
    const flashPool = [];
    const raycaster = new THREE.Raycaster();
    
    // Create shared geometries (only created once)
    sharedLaserGeometry = new THREE.BoxGeometry(0.3, 0.3, 1);
    sharedFlashGeometry = new THREE.SphereGeometry(1.2, 16, 16);
    
    // Pre-create materials for each ship type
    Object.entries(SHIP_LASER_COLORS).forEach(([shipType, colorHex]) => {
        // Create laser material
        laserMaterials[colorHex] = new THREE.MeshBasicMaterial({ 
            color: colorHex, 
            transparent: true, 
            opacity: 0.8 
        });
        
        // Create flash material
        flashMaterials[colorHex] = new THREE.MeshBasicMaterial({ 
            color: colorHex, 
            transparent: true, 
            opacity: 0.8 
        });
    });
    
    // Pre-create a default material
    const defaultColorHex = 0xff0000;
    laserMaterials[defaultColorHex] = new THREE.MeshBasicMaterial({ 
        color: defaultColorHex, 
        transparent: true, 
        opacity: 0.8 
    });
    flashMaterials[defaultColorHex] = new THREE.MeshBasicMaterial({ 
        color: defaultColorHex, 
        transparent: true, 
        opacity: 0.8 
    });
    
    return { laserPool, lasers, flashPool, raycaster };
}

// Get a laser from the pool
export function getLaserFromPool(scene, laserPool, lasers) {
    // Try to reuse an inactive laser first (most efficient)
    for (let i = 0; i < laserPool.length; i++) {
        if (!laserPool[i].visible) {
            laserPool[i].visible = true;
            return laserPool[i];
        }
    }
    
    // Create a new laser if pool isn't full
    if (laserPool.length < MAX_LASERS) {
        const defaultColorHex = 0xff0000;
        const material = laserMaterials[defaultColorHex];
        const newLaser = new THREE.Mesh(sharedLaserGeometry, material);
        newLaser.visible = true;
        newLaser.name = "Laser_" + laserPool.length;
        scene.add(newLaser);
        laserPool.push(newLaser);
        return newLaser;
    }
    
    // If all lasers are active, recycle the oldest one
    const oldestLaser = lasers.shift();
    if (oldestLaser) {
        oldestLaser.visible = true;
        return oldestLaser;
    }
    
    // Fallback - should rarely happen
    return laserPool[0];
}

// Get a flash effect from the pool
export function getFlashFromPool(scene, flashPool) {
    // Try to reuse an inactive flash
    for (const flash of flashPool) {
        if (!flash.visible) {
            flash.visible = true;
            return flash;
        }
    }
    
    // Create a new flash if pool isn't full
    if (flashPool.length < MAX_FLASHES) {
        const defaultColorHex = 0xff0000;
        const material = flashMaterials[defaultColorHex];
        const newFlash = new THREE.Mesh(sharedFlashGeometry, material);
        newFlash.visible = false;
        newFlash.name = "Flash_" + flashPool.length;
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

// Replace preloadSounds with Web Audio API implementation
export function initAudioSystem() {
    // Create audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Buffer storage
    const soundBuffers = {};
    let isAudioInitialized = false;
    
    // *** NEW: Assign to exported variable ***
    audioSystem = { 
        audioContext,
        soundBuffers,
        isAudioInitialized,
        
        // Load a sound and store its buffer
        loadSound: async function(name, url) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                this.soundBuffers[name] = audioBuffer;
                this.isAudioInitialized = true;
                return audioBuffer;
            } catch (error) {
                console.warn('Error loading sound:', error);
                return null;
            }
        },
        
        // Play a sound with optional parameters
        playSound: function(name, options = {}) {
            if (!this.isAudioInitialized || !this.soundBuffers[name]) return null;
            
            // Default options
            const settings = {
                volume: 0.5,
                detune: 0,
                ...options
            };
            
            try {
                // Create source
                const source = this.audioContext.createBufferSource();
                source.buffer = this.soundBuffers[name];
                
                // Create gain node for volume control
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = settings.volume;
                
                // Set detune if provided
                if (settings.detune) {
                    source.detune.value = settings.detune;
                }
                
                // Connect nodes: source -> gain -> destination
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // Start playback
                source.start(0);
                return source;
            } catch (e) {
                console.warn('Could not play sound:', e);
                return null;
            }
        }
    };

    // ** Return the initialized system ***
    return audioSystem; 
}

// Update shootLaser function to use the Web Audio API system
export function shootLaser(scene, player, raycaster, laserPool, lasers, flashPool, audioSystem, orbitLines, sun, planets, socket, remotePlayersRef) {
    // Play laser sound using the new audio system
    if (audioSystem && audioSystem.isAudioInitialized) {
        // Add small random detune for variety
        const detune = Math.random() * 200 - 100; // -100 to 100 cents
        audioSystem.playSound('laser', { volume: 0.4, detune });
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

    // Create a copy of cached objects to test (planets, sun, moon)
    const objectsToTest = [...cachedObjectsToTest];
    
    const intersects = raycaster.intersectObjects(objectsToTest, true);
    
    let targetPoint, targetObject, targetParent, instanceId;

    if (intersects.length > 0) {
        const filteredIntersects = intersects.filter(intersect => {
            const distanceFromPlayer = player.position.distanceTo(intersect.point);
            return distanceFromPlayer >= 6;
        });
        
        if (filteredIntersects.length > 0) {
            targetPoint = filteredIntersects[0].point;
            targetObject = filteredIntersects[0].object;
            
            if (targetObject.isInstancedMesh) {
                instanceId = filteredIntersects[0].instanceId;
            }
            
            // Traverse up to find the actual celestial body Group (Sun, Earth, Moon, etc.)
            let currentParent = targetObject.parent;
            while (currentParent && !['Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Moon'].includes(currentParent.name)) {
                 currentParent = currentParent.parent;
            }
            targetParent = currentParent; // This should now be the Group object like 'Earth' or 'Sun'
        } else {
            targetPoint = startPos.clone().add(direction.clone().multiplyScalar(100));
            targetObject = null;
            targetParent = null;
        }
    } else {
        targetPoint = startPos.clone().add(direction.clone().multiplyScalar(100));
        targetObject = null;
        targetParent = null;
    }
    
    // Get a laser from the pool
    const laser = getLaserFromPool(scene, laserPool, lasers);
    
    // Calculate distance and set laser length
    const distance = startPos.distanceTo(targetPoint);
    laser.scale.z = distance;
    
    // Position laser
    laser.position.copy(startPos.clone().add(direction.clone().multiplyScalar(distance / 2)));
    laser.lookAt(targetPoint);
    
    // Set laser color based on ship type
    if (player.userData && player.userData.shipType) {
        const laserColor = SHIP_LASER_COLORS[player.userData.shipType] || 0xff0000;
        
        // Use existing shared material instead of changing color
        if (laserMaterials[laserColor]) {
            laser.material = laserMaterials[laserColor];
        }
    }
    
    // Set laser properties
    laser.life = 0.3;
    laser.target = targetObject; // Keep for potential client-side effects
    
    lasers.push(laser);
    
    // *** Emit laserFired event to server ***
    if (socket && socket.connected) {
        socket.emit('laserFired', {
            startPos: startPos.toArray(),
            targetPoint: targetPoint.toArray(),
            shipType: player.userData.shipType || 'default'
        });
    }

    // Create impact flash if hitting something (environment)
    if (targetObject) {
        const flash = getFlashFromPool(scene, flashPool);
        flash.position.copy(targetPoint);
        
        flash.name = "Flash";
        flash.visible = true;
        flash.life = 0.2;
        
        // Set flash color based on ship type
        if (player.userData && player.userData.shipType) {
            const laserColor = SHIP_LASER_COLORS[player.userData.shipType] || 0xff0000;
            
            // Use existing shared material instead of changing color
            if (flashMaterials[laserColor]) {
                flash.material = flashMaterials[laserColor];
            }
        }
        
        // Create explosion on environment objects LOCALLY and notify server
        if (targetParent && targetObject.isInstancedMesh && instanceId !== undefined) { // Ensure we have a valid parent and instanceId
            
            // Determine if it's Saturn's rings
            const isSaturnRings = targetParent.name === 'Saturn' &&
                                  targetObject === targetParent.ringInstancedMesh;

            // Determine the ID for the server
            const bodyId = isSaturnRings ? 'SaturnRings' : targetParent.name;

            // Calculate local point relative to the parent Group
            const localPoint = targetParent.worldToLocal(targetPoint.clone());

            // *** Create local explosion immediately for responsiveness ***
            createExplosion(targetParent, localPoint, instanceId, isSaturnRings);

            // *** Report destruction to the server ***
            if (socket && socket.connected) {
                socket.emit('destroyVoxel', {
                    bodyId: bodyId,
                    instanceId: instanceId
                });
                console.log(`Sent destroyVoxel: ${bodyId}, ${instanceId}`);
            }
        }
    }
}

// *** NEW Function: Create a visual-only laser for remote players ***
export function createRemoteLaser(scene, laserPool, lasers, flashPool, startPosArray, targetPointArray, shipType) {
    const startPos = new THREE.Vector3().fromArray(startPosArray);
    const targetPoint = new THREE.Vector3().fromArray(targetPointArray);
    const direction = targetPoint.clone().sub(startPos).normalize();

    const laser = getLaserFromPool(scene, laserPool, lasers); // Reuse pool

    // Calculate distance and set laser length
    const distance = startPos.distanceTo(targetPoint);
    laser.scale.z = distance;

    // Position laser
    laser.position.copy(startPos.clone().add(direction.clone().multiplyScalar(distance / 2)));
    laser.lookAt(targetPoint);

    // Set laser color based on ship type
    const laserColor = SHIP_LASER_COLORS[shipType] || 0xff0000; // Use provided shipType
    if (laserMaterials[laserColor]) {
        laser.material = laserMaterials[laserColor];
    }

    // Set properties for visual-only laser
    laser.life = 0.2; // Shorter lifespan for remote lasers
    laser.target = null; // No target object for remote lasers (no collision check)
    laser.visible = true; // Ensure it's visible

    lasers.push(laser); // Add to active lasers for updateLasers to manage

    // Optional: Create a small impact flash
    const flash = getFlashFromPool(scene, flashPool);
    flash.position.copy(targetPoint);
    flash.name = "RemoteFlash";
    flash.visible = true;
    flash.life = 0.15; // Short lifespan

    // Set flash color based on ship type
    if (flashMaterials[laserColor]) {
        flash.material = flashMaterials[laserColor];
    }
}

// Update lasers (reduce life, hide when expired)
export function updateLasers(lasers, delta) {
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        laser.life -= delta;
        
        if (laser.life <= 0) {
            laser.visible = false;
            lasers.splice(i, 1);
        }
    }
}

// Update flashes (reduce life, hide when expired)
export function updateFlashes(flashPool, delta) {
    flashPool.forEach(flash => {
        if (flash.visible) {
            flash.life -= delta;
            if (flash.life <= 0) {
                flash.visible = false;
            }
        }
    });
}