// Desktop Controls Module
import { activateChat, isChatInputActive } from './chat.js';

const keyboard = {};
let leftMouseHeld = false;
let rightMouseHeld = false;
let mouseMoveX = 0;
let mouseMoveY = 0;
let cursorLockedCallback = null;

export function initDesktopControls() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    
    // Setup pointer lock controls
    setupPointerLockControls();
}

function handleKeyDown(event) {
    keyboard[event.code] = true;

    // Handle T key press for chat activation
    if (event.code === 'KeyT' && !isChatInputActive()) {
        // Only activate chat if we're in game
        const uiManager = window.uiManager;
        if (uiManager && uiManager.isPlaying()) {
            activateChat();
            event.preventDefault();
        }
    }

    if (event.code === 'Escape') {
        event.preventDefault();
    }
}

function handleKeyUp(event) {
    keyboard[event.code] = false;
}

function handleMouseDown(event) {
    // Ignore mouse events when chat is active
    if (isChatInputActive()) return;
    
    if (event.button === 0) leftMouseHeld = true;
    if (event.button === 2) rightMouseHeld = true;
}

function handleMouseUp(event) {
    // Ignore mouse events when chat is active
    if (isChatInputActive()) return;
    
    if (event.button === 0) leftMouseHeld = false;
    if (event.button === 2) rightMouseHeld = false;
}

function handleMouseMove(event) {
    // Ignore mouse movement when chat is active
    if (isChatInputActive()) {
        mouseMoveX = 0;
        mouseMoveY = 0;
        return;
    }
    
    // Only track mouse movement when pointer is locked
    if (document.pointerLockElement === document.body || 
        document.mozPointerLockElement === document.body ||
        document.webkitPointerLockElement === document.body) {
        
        // Store mouse movement deltas
        mouseMoveX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        mouseMoveY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    } else {
        mouseMoveX = 0;
        mouseMoveY = 0;
    }
}

export function isKeyPressed(keyCode) {
    // Ignore key presses when chat is active
    if (isChatInputActive()) return false;
    
    return !!keyboard[keyCode];
}

export function isLeftMouseHeld() {
    // Ignore mouse input when chat is active
    if (isChatInputActive()) return false;
    
    return leftMouseHeld;
}

export function isRightMouseHeld() {
    // Ignore mouse input when chat is active
    if (isChatInputActive()) return false;
    
    return rightMouseHeld;
}

export function getMouseMovement() {
    // Ignore mouse movement when chat is active
    if (isChatInputActive()) {
        return { x: 0, y: 0 };
    }
    
    const movement = { x: mouseMoveX, y: mouseMoveY };
    // Reset after reading to prevent continuous movement
    mouseMoveX = 0;
    mouseMoveY = 0;
    return movement;
}

// Setup pointer lock controls
export function setupPointerLockControls() {
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
function handlePointerLockChange() {
    const isLocked = document.pointerLockElement === document.body || 
                    document.mozPointerLockElement === document.body ||
                    document.webkitPointerLockElement === document.body;
    
    if (cursorLockedCallback) {
        cursorLockedCallback(isLocked);
    }
}

// Register a callback for pointer lock changes
export function registerPointerLockCallback(callback) {
    cursorLockedCallback = callback;
} 