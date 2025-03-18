import * as THREE from 'three';
import { createExplosion } from './celestialBodies.js';

// Constants
export const MAX_LASERS = 20;
export const MAX_FLASHES = 10;

// Ship type to laser color mapping
const SHIP_LASER_COLORS = {
    'default': 0xff3333,         // Red for default ship
    'Flowers Ship': 0x333333,    // Updated to dark gray (black) for Flowers ship
    'Angel Ship': 0xffd700,      // Gold for Angel ship
    'Chris Ship': 0x3366cc       // Blue for Chris ship
};

// Initialize weapon systems
export function initWeapons(scene) {
    const laserPool = [];
    const lasers = [];
    const flashPool = [];
    const raycaster = new THREE.Raycaster();
    
    return { laserPool, lasers, flashPool, raycaster };
}

// Get a laser from the pool
export function getLaserFromPool(scene, laserPool, lasers) {
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
    
    // Recycle oldest inactive laser safely
    for (let i = 0; i < lasers.length; i++) {
        if (!lasers[i].visible) {
            const reusableLaser = lasers.splice(i, 1)[0];
            reusableLaser.visible = true;
            return reusableLaser;
        }
    }

    // If all lasers are active, recycle the oldest laser
    const oldestLaser = lasers.shift();
    oldestLaser.visible = true;
    return oldestLaser;
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

// Shoot a laser
export function shootLaser(scene, player, raycaster, laserPool, lasers, flashPool, soundPool, soundsLoaded, orbitLines, sun, planets, socket, remotePlayersRef) {
    // Play sound from pool if available
    if (soundsLoaded) {
        const availableSound = soundPool.find(s => s.audio.paused || s.audio.ended);
        if (availableSound) {
            availableSound.audio.currentTime = 0;
            availableSound.audio.play().catch(e => {
                console.warn('Could not play sound:', e);
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
    
    let targetPoint, targetObject, targetParent, instanceId;
    let hitRemotePlayer = null;
    
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
            
            // Check if we hit a remote player
            if (remotePlayersRef && Object.keys(remotePlayersRef).length > 0) {
                console.log("Checking for remote player hits among", Object.keys(remotePlayersRef).length, "players");
                
                // Check if the hit object is part of a remote player
                for (const playerId in remotePlayersRef) {
                    const remotePlayer = remotePlayersRef[playerId];
                    
                    // Debug the remote player structure
                    console.log(`Remote player ${playerId} structure:`, remotePlayer);
                    
                    // The remote player IS the mesh in your implementation
                    const isDirectHit = targetObject === remotePlayer;
                    
                    // Check if it's a child of the remote player
                    let isChildHit = false;
                    if (remotePlayer.children && remotePlayer.children.length > 0) {
                        // Recursive function to check all descendants
                        const checkChildren = (parent) => {
                            for (const child of parent.children) {
                                if (child === targetObject) return true;
                                if (child.children && child.children.length > 0) {
                                    if (checkChildren(child)) return true;
                                }
                            }
                            return false;
                        };
                        
                        isChildHit = checkChildren(remotePlayer);
                    }
                    
                    if (isDirectHit || isChildHit) {
                        hitRemotePlayer = playerId;
                        console.log(`Hit remote player: ${playerId}`);
                        break;
                    }
                }
            }
            
            // Capture the instance ID if we hit an instanced mesh
            if (targetObject.isInstancedMesh) {
                instanceId = filteredIntersects[0].instanceId;
            }
            
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
        laser.material.color.setHex(laserColor);
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
        
        // Set flash color based on ship type
        if (player.userData && player.userData.shipType) {
            const laserColor = SHIP_LASER_COLORS[player.userData.shipType] || 0xff0000;
            flash.material.color.setHex(laserColor);
        }
        
        // If we hit a remote player, send a hit event to the server
        if (hitRemotePlayer && socket) {
            console.log(`Sending playerHit event for player: ${hitRemotePlayer}`);
            
            // Remove the debug hit marker visualization
            // We're commenting out this code to hide the collision shape
            /*
            const hitMarker = new THREE.Mesh(
                new THREE.SphereGeometry(1, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
            );
            hitMarker.position.copy(targetPoint);
            scene.add(hitMarker);
            
            // Remove after 1 second
            setTimeout(() => scene.remove(hitMarker), 1000);
            */
            
            // Show elimination message
            if (window.uiManager) {
                window.uiManager.showEliminationMessage(100);
            }
            
            socket.emit('playerHit', { 
                targetId: hitRemotePlayer,
                position: {
                    x: Math.random() * 100 - 50,
                    y: Math.random() * 50 + 10,
                    z: Math.random() * 100 - 50
                }
            });
        }
        
        // Create explosion
        if (targetParent && 
            (targetParent === sun || 
             planets.includes(targetParent) || 
             planets.some(p => p.moon && targetParent === p.moon))) {
            
            // Convert world coordinates to local coordinates for the explosion
            const localPoint = targetParent.worldToLocal(targetPoint.clone());
            
            // Check if we hit Saturn's rings specifically
            const isSaturnRings = targetParent.name === 'Saturn' && 
                                 targetObject === targetParent.ringInstancedMesh;
            
            setTimeout(() => {
                // Pass the instanceId and a flag indicating if this is Saturn's rings
                createExplosion(targetParent, localPoint, instanceId, isSaturnRings);
            }, 300);
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

// Preload sound effects
export function preloadSounds(laserSoundUrl, MAX_SOUNDS) {
    const soundPool = [];
    
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
    
    return soundPool;
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