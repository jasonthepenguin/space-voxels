// UI Manager with State Machine Pattern
import * as THREE from 'three';

// Game States
export const GameState = {
    MAIN_MENU: 'MAIN_MENU',
    SHIP_BUILDER: 'SHIP_BUILDER',
    PLAYING: 'PLAYING'
};

class UIManager {
    constructor() {
        // Current game state
        this.currentState = GameState.MAIN_MENU;
        
        // UI Elements
        this.instructionsElement = document.getElementById('instructions');
        this.shipBuilderElement = document.getElementById('ship-builder-ui');
        this.crosshairElement = document.getElementById('crosshair');
        this.fpsCounterElement = document.getElementById('fps-counter');
        this.playersCounterElement = document.getElementById('players-counter');
        
        // Buttons
        this.startButton = document.getElementById('start-button');
        this.shipBuilderButton = document.getElementById('ship-builder-button');
        this.returnButton = document.getElementById('return-button');
        
        // Game references
        this.camera = null;
        this.gameStartCallback = null;
        
        // FPS counter variables
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        // Animation flag to prevent multiple animations
        this.isAnimating = false;
        
        // Initialize
        this.setupEventListeners();
        this.startFPSCounter();
    }
    
    // Initialize with game objects
    init(camera, gameStartCallback) {
        this.camera = camera;
        this.gameStartCallback = gameStartCallback;
        
        // Expose camera to window for UI animations
        window.threeCamera = camera;
        
        // Set initial UI state
        this.changeState(GameState.MAIN_MENU);
    }
    
    // Change the game state
    changeState(newState) {
        const prevState = this.currentState;
        this.currentState = newState;
        
        // Handle UI changes based on state transition
        switch (newState) {
            case GameState.MAIN_MENU:
                this.instructionsElement.style.display = 'block';
                this.shipBuilderElement.style.display = 'none';
                this.crosshairElement.style.display = 'none';
                this.playersCounterElement.style.display = 'none';
                break;
                
            case GameState.SHIP_BUILDER:
                this.instructionsElement.style.display = 'none';
                this.shipBuilderElement.style.display = 'block';
                this.crosshairElement.style.display = 'none';
                this.playersCounterElement.style.display = 'none';
                break;
                
            case GameState.PLAYING:
                this.instructionsElement.style.display = 'none';
                this.shipBuilderElement.style.display = 'none';
                this.crosshairElement.style.display = 'block';
                this.playersCounterElement.style.display = 'block';
                
                // Request pointer lock
                document.body.requestPointerLock = document.body.requestPointerLock || 
                                                document.body.mozRequestPointerLock ||
                                                document.body.webkitRequestPointerLock;
                document.body.requestPointerLock();
                
                // Call the game start callback
                if (this.gameStartCallback) {
                    this.gameStartCallback();
                }
                break;
        }
        
        console.log(`Game state changed from ${prevState} to ${newState}`);
    }
    
    // Setup all UI event listeners
    setupEventListeners() {
        // Start button
        this.startButton.addEventListener('click', () => {
            this.changeState(GameState.PLAYING);
        });
        
        // Ship builder button
        this.shipBuilderButton.addEventListener('click', () => {
            if (this.camera && this.currentState === GameState.MAIN_MENU && !this.isAnimating) {
                this.startCameraRotation(180, () => {
                    this.changeState(GameState.SHIP_BUILDER);
                });
            }
        });
        
        // Return button
        this.returnButton.addEventListener('click', () => {
            if (this.camera && this.currentState === GameState.SHIP_BUILDER && !this.isAnimating) {
                this.startCameraRotation(180, () => {
                    this.changeState(GameState.MAIN_MENU);
                });
            }
        });
        
        // Handle pointer lock change
        document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
        document.addEventListener('mozpointerlockchange', this.handlePointerLockChange.bind(this));
        document.addEventListener('webkitpointerlockchange', this.handlePointerLockChange.bind(this));
    }
    
    // Handle pointer lock change
    handlePointerLockChange() {
        if (document.pointerLockElement === document.body || 
            document.mozPointerLockElement === document.body ||
            document.webkitPointerLockElement === document.body) {
            // Pointer is locked, we're in game mode
            console.log("Pointer locked - game mode");
            this.crosshairElement.style.display = 'block';
            this.playersCounterElement.style.display = 'block';
            
            // Only change state if we're not already playing
            if (this.currentState !== GameState.PLAYING) {
                this.changeState(GameState.PLAYING);
            }
        } else {
            // Pointer is unlocked, we're in menu mode
            console.log("Pointer unlocked - menu mode");
            this.crosshairElement.style.display = 'none';
            this.playersCounterElement.style.display = 'none';
            
            // Only return to menu if we were playing
            if (this.currentState === GameState.PLAYING) {
                this.changeState(GameState.MAIN_MENU);
                
                // Call reset game if available
                if (window.resetGame) {
                    window.resetGame();
                }
            }
        }
    }
    
    // Camera rotation animation
    startCameraRotation(targetAngle, callback) {
        if (!this.camera) {
            console.error('Camera not available');
            return;
        }
        
        // Set animation flags to prevent multiple animations
        this.isAnimating = true;
        window.cameraAnimating = true;
        
        // Disable buttons during animation
        if (this.shipBuilderButton) this.shipBuilderButton.disabled = true;
        if (this.returnButton) this.returnButton.disabled = true;
        
        const startRotation = this.camera.rotation.y;
        const endRotation = startRotation + (targetAngle * Math.PI / 180);
        const duration = 1000; // 1 second animation
        const startTime = performance.now();
        
        const animateRotation = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use easeInOutQuad for smoother animation
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            this.camera.rotation.y = startRotation + (endRotation - startRotation) * easeProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animateRotation);
            } else {
                // Animation complete
                window.cameraAnimating = false;
                this.isAnimating = false;
                
                // Re-enable buttons
                if (this.shipBuilderButton) this.shipBuilderButton.disabled = false;
                if (this.returnButton) this.returnButton.disabled = false;
                
                if (callback) callback();
            }
        };
        
        requestAnimationFrame(animateRotation);
    }
    
    // FPS counter
    startFPSCounter() {
        const updateFPS = () => {
            this.frameCount++;
            const currentTime = performance.now();
            const elapsed = currentTime - this.lastTime;
            
            if (elapsed >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / elapsed);
                this.fpsCounterElement.textContent = `FPS: ${fps}`;
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        // Start the FPS counter
        updateFPS();
    }
    
    // Get current state
    getState() {
        return this.currentState;
    }
    
    // Check if game is in playing state
    isPlaying() {
        return this.currentState === GameState.PLAYING;
    }
}

// Create and export a singleton instance
const uiManager = new UIManager();
export default uiManager; 