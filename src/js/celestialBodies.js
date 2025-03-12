import * as THREE from 'three';

// Colors for celestial bodies
export const celestialColors = {
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

// Global scaling factors
export const ORBIT_SPEED_MULTIPLIER = 12;
export const PLANET_SIZE_MULTIPLIER = 2;
export const ORBIT_RADIUS_MULTIPLIER = 1.2;

// Planet data: name, size, orbit_radius, orbit_speed
export const planetData = [
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

// Create sun
export function createSun(scene, voxelGeometry) {
    const sun = new THREE.Group();
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
    return sun;
}

// Create orbit lines to help visualize where planets are
export function createOrbitLines(scene, planetData) {
    const orbitLines = [];
    
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
    
    return orbitLines;
}

// Create planets
export function createPlanets(scene, voxelGeometry, planetData) {
    const planets = [];
    
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
    
    return planets;
}

// Create Saturn's rings
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

// Create Earth's moon
export function createMoon(planets) {
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
        
        const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
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

// Update planet positions
export function updatePlanets(planets, delta) {
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

// Create explosion when a celestial body is hit
export function createExplosion(parent, targetPos, instanceId = null, isSaturnRings = false) {
    // If the parent doesn't have an instancedMesh or ringInstancedMesh, it's not a voxel-based object
    if (!parent.instancedMesh && !parent.ringInstancedMesh) {
        return;
    }
    
    // If we have a specific instanceId, only destroy that voxel
    if (instanceId !== null) {
        // Hide the specific voxel by moving it far away
        const matrix = new THREE.Matrix4();
        matrix.setPosition(1000, 1000, 1000); // Move far away
        
        if (isSaturnRings && parent.ringInstancedMesh) {
            // Handle Saturn's rings
            parent.ringInstancedMesh.setMatrixAt(instanceId, matrix);
            parent.ringInstancedMesh.instanceMatrix.needsUpdate = true;
            
            // Initialize destroyedRingVoxels if it doesn't exist
            if (!parent.destroyedRingVoxels) {
                parent.destroyedRingVoxels = {};
            }
            
            // Find and store the original position before removing from ringDict
            for (const [key, value] of Object.entries(parent.ringDict)) {
                if (value === instanceId) {
                    // Store the original position (x,y,z from the key)
                    const [x, y, z] = key.split(',').map(Number);
                    parent.destroyedRingVoxels[instanceId] = { x, y, z };
                    delete parent.ringDict[key];
                    break;
                }
            }
        } else if (parent.instancedMesh) {
            // Handle regular planet/sun voxels
            parent.instancedMesh.setMatrixAt(instanceId, matrix);
            parent.instancedMesh.instanceMatrix.needsUpdate = true;
            
            // Initialize destroyedVoxels if it doesn't exist
            if (!parent.destroyedVoxels) {
                parent.destroyedVoxels = {};
            }
            
            // Find and store the original position before removing from blockDict
            for (const [key, value] of Object.entries(parent.blockDict)) {
                if (value === instanceId) {
                    // Store the original position (x,y,z from the key)
                    const [x, y, z] = key.split(',').map(Number);
                    parent.destroyedVoxels[instanceId] = { x, y, z };
                    delete parent.blockDict[key];
                    break;
                }
            }
        }
        
        return;
    }
    
    // Fallback to original radius-based explosion if no instanceId is provided
    const radius = 1.5;
    
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

// New function to respawn all voxels for a celestial body
export function respawnPlanetVoxels(parent) {
    if (!parent) return;
    
    const matrix = new THREE.Matrix4();
    
    // Respawn main body voxels
    if (parent.instancedMesh && parent.destroyedVoxels) {
        for (const [instanceId, position] of Object.entries(parent.destroyedVoxels)) {
            // Move voxel back to its original position
            matrix.setPosition(position.x, position.y, position.z);
            parent.instancedMesh.setMatrixAt(parseInt(instanceId), matrix);
            
            // Restore entry in blockDict
            parent.blockDict[`${position.x},${position.y},${position.z}`] = parseInt(instanceId);
        }
        
        // Update the instance matrix
        parent.instancedMesh.instanceMatrix.needsUpdate = true;
        
        // Clear the destroyed voxels record
        parent.destroyedVoxels = {};
    }
    
    // Respawn Saturn's rings if applicable
    if (parent.ringInstancedMesh && parent.destroyedRingVoxels) {
        for (const [instanceId, position] of Object.entries(parent.destroyedRingVoxels)) {
            // Move ring voxel back to its original position
            matrix.setPosition(position.x, position.y, position.z);
            parent.ringInstancedMesh.setMatrixAt(parseInt(instanceId), matrix);
            
            // Restore entry in ringDict
            parent.ringDict[`${position.x},${position.y},${position.z}`] = parseInt(instanceId);
        }
        
        // Update the instance matrix
        parent.ringInstancedMesh.instanceMatrix.needsUpdate = true;
        
        // Clear the destroyed ring voxels record
        parent.destroyedRingVoxels = {};
    }
}

// Function to respawn all celestial bodies in the solar system
export function respawnAllCelestialBodies(sun, planets) {
    // Respawn the sun
    if (sun) {
        respawnPlanetVoxels(sun);
    }
    
    // Respawn all planets
    if (planets && planets.length > 0) {
        planets.forEach(planet => {
            respawnPlanetVoxels(planet);
            
            // Respawn moon if the planet has one
            if (planet.moon) {
                respawnPlanetVoxels(planet.moon);
            }
        });
    }
} 