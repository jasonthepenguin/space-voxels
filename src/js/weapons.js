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
    
    return {
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

    // Create a copy of cached objects to test
    const objectsToTest = [...cachedObjectsToTest];
    
    // Add VISIBLE remote players (these change frequently so we add them each time)
    if (remotePlayersRef) {
        Object.values(remotePlayersRef).forEach(remotePlayer => {
            // *** Only add visible players to the list of targets ***
            if (remotePlayer.visible) {
                objectsToTest.push(remotePlayer);
                // Include player's children ONLY if the parent is visible
                remotePlayer.children.forEach(child => objectsToTest.push(child));
            }
        });
    }
    
    // ONLY raycast against objects we care about
    const intersects = raycaster.intersectObjects(objectsToTest, true);
    
    let targetPoint, targetObject, targetParent, instanceId;
    let hitRemotePlayer = null;
    
    if (intersects.length > 0) {
        // Only check distance from player to avoid too-close hits
        const filteredIntersects = intersects.filter(intersect => {
            // Check if the intersection point is too close to the player
            const distanceFromPlayer = player.position.distanceTo(intersect.point);
            return distanceFromPlayer >= 6; // Only include if not too close
        });
        
        if (filteredIntersects.length > 0) {
            // Hit something valid
            targetPoint = filteredIntersects[0].point;
            targetObject = filteredIntersects[0].object;
            
            // Check if we hit a remote player - OPTIMIZED
            if (remotePlayersRef && Object.keys(remotePlayersRef).length > 0) {
                for (const playerId in remotePlayersRef) {
                    const remotePlayer = remotePlayersRef[playerId];
                    
                    // *** Only consider hits on VISIBLE remote players ***
                    if (!remotePlayer.visible) continue; 

                    // Check if direct hit on player or any child
                    let isHit = targetObject === remotePlayer;
                    
                    if (!isHit && remotePlayer.children) {
                        for (const child of remotePlayer.children) {
                            if (targetObject === child) {
                                isHit = true;
                                break;
                            }
                        }
                    }
                    
                    if (isHit) {
                        hitRemotePlayer = playerId;
                        break;
                    }
                }
            }
            
            // Capture instance ID for instanced meshes
            if (targetObject.isInstancedMesh) {
                instanceId = filteredIntersects[0].instanceId;
            }
            
            // Find the parent group (sun, planet, or moon)
            targetParent = targetObject.parent;
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
    laser.target = targetObject;
    
    lasers.push(laser);
    
    // Create impact flash if hitting something
    if (targetObject) {
        const flash = getFlashFromPool(scene, flashPool);
        flash.position.copy(targetPoint);
        
        flash.name = "Flash"; // Add a name to help with identification
        flash.visible = true;
        flash.life = 0.2; // lifespan in seconds
        
        // Set flash color based on ship type using shared materials
        if (player.userData && player.userData.shipType) {
            const laserColor = SHIP_LASER_COLORS[player.userData.shipType] || 0xff0000;
            
            // Use existing shared material instead of changing color
            if (flashMaterials[laserColor]) {
                flash.material = flashMaterials[laserColor];
            }
        }
        
        // If we hit a remote player, send a hit event to the server
        if (hitRemotePlayer && socket) {
            // *** NOTE: The event is now 'playerDied' which should be handled server-side
            // to manage player states and broadcast necessary events ('playerHit', 'playerRespawned').
            // Client-side, we primarily react to these broadcasts.
            console.log(`Sending playerDied event for player: ${hitRemotePlayer}`);
            
            // Show elimination message
            if (window.uiManager) {
                window.uiManager.showEliminationMessage(100); 
            }
            
            socket.emit('playerDied', { 
                targetId: hitRemotePlayer
            });
        }
        
        // Create explosion
        if (targetObject && targetParent && 
            (targetParent === sun || 
             planets.includes(targetParent) || 
             planets.some(p => p.moon && targetParent === p.moon))) {
            
            // Convert world coordinates to local coordinates for the explosion
            const localPoint = targetParent.worldToLocal(targetPoint.clone());
            
            // Check if we hit Saturn's rings specifically
            const isSaturnRings = targetParent.name === 'Saturn' && 
                                 targetObject === targetParent.ringInstancedMesh;
            
            // OPTIMIZATION: Create explosion immediately - no setTimeout
            createExplosion(targetParent, localPoint, instanceId, isSaturnRings);
        }
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