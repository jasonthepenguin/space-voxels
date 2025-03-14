import * as THREE from 'three';
import { celestialColors } from './celestialBodies.js';

// Load skybox textures
export function loadStarsTexture(textureLoader, skyboxTextures) {
    const textures = {};
    
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
    
    return textures;
}

// Create skybox
export function createSkybox(scene, textures) {
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
    return skybox;
}

// Setup lighting
export function setupLighting(scene) {
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
    
    return { ambientLight, directionalLight, hemisphereLight };
}

// Create UI elements (crosshair)
export function createUI() {
    // Create crosshair
    const crosshairElement = document.getElementById('crosshair');
    if (!crosshairElement) {
        const newCrosshairElement = document.createElement('div');
        newCrosshairElement.id = 'crosshair';
        newCrosshairElement.style.position = 'absolute';
        newCrosshairElement.style.top = '50%';
        newCrosshairElement.style.left = '50%';
        newCrosshairElement.style.width = '10px';
        newCrosshairElement.style.height = '10px';
        newCrosshairElement.style.borderRadius = '50%';
        newCrosshairElement.style.border = '1px solid rgba(255, 255, 255, 0.7)';
        newCrosshairElement.style.transform = 'translate(-50%, -50%)';
        newCrosshairElement.style.pointerEvents = 'none';
        newCrosshairElement.style.display = 'none'; // Hide initially
        document.body.appendChild(newCrosshairElement);
        return newCrosshairElement;
    }
    
    return crosshairElement;
}

// Setup pointer lock controls
export function setupControls() {
    // Check if device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    (window.innerWidth <= 800 && window.innerHeight <= 900);
    
    // Only add pointer lock event listeners on desktop
    if (!isMobile) {
        document.addEventListener('pointerlockchange', handlePointerLockChange);
        document.addEventListener('mozpointerlockchange', handlePointerLockChange);
        document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
    }
}

// Handle pointer lock change events
export function handlePointerLockChange(cursorLockedCallback) {
    const isLocked = document.pointerLockElement === document.body || 
                    document.mozPointerLockElement === document.body ||
                    document.webkitPointerLockElement === document.body;
    
    if (cursorLockedCallback) {
        cursorLockedCallback(isLocked);
    }
    
    return isLocked;
} 