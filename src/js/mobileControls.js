// Mobile Controls Module
import * as THREE from 'three';
import { isPlayerDead } from './networking.js';

// Constants
const JOYSTICK_MAX_DISTANCE = 40; // Maximum distance joystick can move from center

let fireButtonHeld = false;
let boostButtonHeld = false;

// State variables
let isMobile = false;
let mobileControlsActive = false;
let moveJoystickActive = false;
let lookAreaActive = false;
let moveJoystickStartPos = { x: 0, y: 0 };
let moveJoystickCurrentPos = { x: 0, y: 0 };
let lookAreaStartPos = { x: 0, y: 0 };
let lookAreaCurrentPos = { x: 0, y: 0 };
let lookAreaDelta = { x: 0, y: 0 };

// DOM elements
let mobileControls;
let joystickArea;
let joystick;
let lookArea;
let fireButton;
let boostButton;

export function isFireButtonHeld() {
    return fireButtonHeld;
}

export function isBoostActive() {
    return boostButtonHeld;
}

// Initialize mobile controls
export function initMobileControls() {
    // Check if device is mobile
    isMobile = detectMobile();
    
    // Get DOM elements
    mobileControls = document.getElementById('mobile-controls');
    joystickArea = document.getElementById('mobile-joystick-area');
    joystick = document.getElementById('mobile-joystick');
    lookArea = document.getElementById('mobile-look-area');
    fireButton = document.getElementById('mobile-fire-button');
    boostButton = document.getElementById('mobile-boost-button');
    
    if (!mobileControls || !joystickArea || !joystick || !lookArea || !fireButton || !boostButton) {
        console.error('Mobile control elements not found');
        return;
    }
    
    // Setup event listeners for mobile controls
    setupMobileEventListeners();
    
    return { isMobile };
}

// Detect if device is mobile
function detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 800 && window.innerHeight <= 900);
}

// Setup mobile event listeners
function setupMobileEventListeners() {
    // Move joystick events
    joystickArea.addEventListener('touchstart', handleMoveJoystickStart, { passive: false });
    joystickArea.addEventListener('touchmove', handleMoveJoystickMove, { passive: false });
    joystickArea.addEventListener('touchend', handleMoveJoystickEnd, { passive: false });
    
    // Look area events
    lookArea.addEventListener('touchstart', handleLookAreaStart, { passive: false });
    lookArea.addEventListener('touchmove', handleLookAreaMove, { passive: false });
    lookArea.addEventListener('touchend', handleLookAreaEnd, { passive: false });
    
    // Fire button events - continuous firing support
    fireButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        fireButtonHeld = true;

        // Visual feedback for button press
        fireButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        fireButton.style.transform = 'scale(0.95)';
    }, { passive: false });

    fireButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        fireButtonHeld = false;

        // Reset button appearance
        fireButton.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        fireButton.style.transform = 'scale(1)';
    }, { passive: false });
    
    // Boost button events
    boostButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        boostButtonHeld = true;
        
        // Visual feedback for button press
        boostButton.style.backgroundColor = 'rgba(0, 191, 255, 0.8)';
        boostButton.style.transform = 'scale(0.95)';
    }, { passive: false });
    
    boostButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        boostButtonHeld = false;
        
        // Reset button appearance
        boostButton.style.backgroundColor = 'rgba(0, 191, 255, 0.5)';
        boostButton.style.transform = 'scale(1)';
    }, { passive: false });
}

// Handle move joystick touch start
function handleMoveJoystickStart(e) {
    e.preventDefault();
    moveJoystickActive = true;
    
    const touch = e.touches[0];
    const rect = joystickArea.getBoundingClientRect();
    
    moveJoystickStartPos = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
    
    moveJoystickCurrentPos = {
        x: touch.clientX,
        y: touch.clientY
    };
    
    updateJoystickPosition();
}

// Handle move joystick touch move
function handleMoveJoystickMove(e) {
    e.preventDefault();
    if (!moveJoystickActive) return;
    
    const touch = e.touches[0];
    moveJoystickCurrentPos = {
        x: touch.clientX,
        y: touch.clientY
    };
    
    updateJoystickPosition();
}

// Handle move joystick touch end
function handleMoveJoystickEnd(e) {
    e.preventDefault();
    moveJoystickActive = false;
    
    // Reset joystick position
    joystick.style.transform = 'translate(-50%, -50%)';
}

// Update joystick position
function updateJoystickPosition() {
    if (!moveJoystickActive) return;
    
    // Calculate distance from center
    let dx = moveJoystickCurrentPos.x - moveJoystickStartPos.x;
    let dy = moveJoystickCurrentPos.y - moveJoystickStartPos.y;
    
    // Calculate distance
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Limit distance to max
    if (distance > JOYSTICK_MAX_DISTANCE) {
        dx = dx * JOYSTICK_MAX_DISTANCE / distance;
        dy = dy * JOYSTICK_MAX_DISTANCE / distance;
    }
    
    // Update joystick position
    joystick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

// Handle look area touch start
function handleLookAreaStart(e) {
    e.preventDefault();
    lookAreaActive = true;
    
    const touch = e.touches[0];
    lookAreaStartPos = {
        x: touch.clientX,
        y: touch.clientY
    };
    
    lookAreaCurrentPos = {
        x: touch.clientX,
        y: touch.clientY
    };
    
    lookAreaDelta = { x: 0, y: 0 };
}

// Handle look area touch move
function handleLookAreaMove(e) {
    e.preventDefault();
    if (!lookAreaActive) return;
    
    const touch = e.touches[0];
    
    // Calculate delta from last position
    const newX = touch.clientX;
    const newY = touch.clientY;
    
    lookAreaDelta = {
        x: newX - lookAreaCurrentPos.x,
        y: newY - lookAreaCurrentPos.y
    };
    
    lookAreaCurrentPos = {
        x: newX,
        y: newY
    };
}

// Handle look area touch end
function handleLookAreaEnd(e) {
    e.preventDefault();
    lookAreaActive = false;
    lookAreaDelta = { x: 0, y: 0 };
}

// Show mobile controls
export function showMobileControls() {
    if (!isMobile) return;
    
    mobileControls.style.display = 'block';
    mobileControlsActive = true;
}

// Hide mobile controls
export function hideMobileControls() {
    if (!isMobile) return;
    
    mobileControls.style.display = 'none';
    mobileControlsActive = false;
}

// Get joystick values for movement
export function getJoystickValues() {
    if (!moveJoystickActive || !mobileControlsActive || isPlayerDead()) {
        return { x: 0, y: 0 };
    }
    
    // Calculate normalized values (-1 to 1)
    let dx = moveJoystickCurrentPos.x - moveJoystickStartPos.x;
    let dy = moveJoystickCurrentPos.y - moveJoystickStartPos.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > JOYSTICK_MAX_DISTANCE) {
        dx = dx * JOYSTICK_MAX_DISTANCE / distance;
        dy = dy * JOYSTICK_MAX_DISTANCE / distance;
    }
    
    return {
        x: dx / JOYSTICK_MAX_DISTANCE,
        y: dy / JOYSTICK_MAX_DISTANCE
    };
}

// Get look area delta values for camera rotation
export function getLookDelta() {
    if (!lookAreaActive || !mobileControlsActive || isPlayerDead()) {
        return { x: 0, y: 0 };
    }
    
    return {
        x: lookAreaDelta.x * 0.1, // Scale down for smoother movement
        y: lookAreaDelta.y * 0.1
    };
}

// Check if fire button is active - no longer needed for tap-only firing
// but keeping a stub for compatibility
export function isFireButtonActive() {
    return false; // Always return false since we're using tap-only
}

// Check if device is mobile
export function checkIsMobile() {
    return isMobile;
}

// Update mobile controls state
export function updateMobileControlsState() {
    // Reset deltas
    lookAreaDelta = { x: 0, y: 0 };
} 