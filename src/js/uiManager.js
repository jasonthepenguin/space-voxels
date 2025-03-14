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
        this.resumeOverlayElement = document.getElementById('resume-overlay');
        this.mobileControlsElement = document.getElementById('mobile-controls');
        
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
        
        // Mobile detection
        this.isMobile = this.detectMobile();
        
        // Initialize
        this.setupEventListeners();
        this.startFPSCounter();
    }
    
    // Detect if device is mobile
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (window.innerWidth <= 800 && window.innerHeight <= 900);
    }
    
    // Initialize with game objects
    init(camera, gameStartCallback) {
        this.camera = camera;
        this.gameStartCallback = gameStartCallback;
        
        // Expose camera to window for UI animations
        window.threeCamera = camera;
        
        // Set initial UI state
        this.changeState(GameState.MAIN_MENU);
        
        // Apply mobile-specific adjustments
        if (this.isMobile) {
            this.applyMobileAdjustments();
        }
    }
    
    // Apply mobile-specific UI adjustments
    applyMobileAdjustments() {
        // Adjust button sizes and spacing for touch
        if (this.startButton) {
            this.startButton.style.padding = '15px 40px';
            this.startButton.style.margin = '15px 0';
            this.startButton.style.fontSize = '18px';
        }
        
        if (this.shipBuilderButton) {
            this.shipBuilderButton.style.padding = '15px 40px';
            this.shipBuilderButton.style.margin = '15px 0';
            this.shipBuilderButton.style.fontSize = '18px';
        }
        
        if (this.returnButton) {
            this.returnButton.style.padding = '15px 40px';
            this.returnButton.style.fontSize = '18px';
        }
        
        // Update instructions for mobile
        if (this.instructionsElement) {
            const mobileTip = document.createElement('p');
            mobileTip.textContent = 'Mobile controls will appear when you start the game.';
            mobileTip.style.color = '#4CAF50';
            mobileTip.style.fontWeight = 'bold';
            this.instructionsElement.appendChild(mobileTip);
        }
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
                if (this.resumeOverlayElement) {
                    this.resumeOverlayElement.style.display = 'none';
                }
                if (this.mobileControlsElement) {
                    this.mobileControlsElement.style.display = 'none';
                }
                break;
                
            case GameState.SHIP_BUILDER:
                this.instructionsElement.style.display = 'none';
                this.shipBuilderElement.style.display = 'block';
                this.crosshairElement.style.display = 'none';
                this.playersCounterElement.style.display = 'none';
                if (this.resumeOverlayElement) {
                    this.resumeOverlayElement.style.display = 'none';
                }
                if (this.mobileControlsElement) {
                    this.mobileControlsElement.style.display = 'none';
                }
                break;
                
            case GameState.PLAYING:
                this.instructionsElement.style.display = 'none';
                this.shipBuilderElement.style.display = 'none';
                this.crosshairElement.style.display = 'block';
                this.playersCounterElement.style.display = 'block';
                if (this.resumeOverlayElement) {
                    this.resumeOverlayElement.style.display = 'none';
                }
                
                // Only request pointer lock on desktop
                if (!this.isMobile) {
                    document.body.requestPointerLock = document.body.requestPointerLock || 
                                                    document.body.mozRequestPointerLock ||
                                                    document.body.webkitRequestPointerLock;
                    document.body.requestPointerLock();
                }
                
                // Call the game start callback
                if (this.gameStartCallback && prevState === GameState.MAIN_MENU) {
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
        
        // Resume overlay click
        if (this.resumeOverlayElement) {
            this.resumeOverlayElement.addEventListener('click', (event) => {
                if (this.currentState === GameState.PLAYING) {
                    event.preventDefault();
                    window.focus();
                    
                    // Only handle pointer lock on desktop
                    if (!this.isMobile) {
                        // Slight delay to reliably regain pointer lock after ESC
                        setTimeout(() => {
                            const requestPointerLock = document.body.requestPointerLock ||
                                                    document.body.mozRequestPointerLock ||
                                                    document.body.webkitRequestPointerLock;
            
                            if (requestPointerLock) {
                                requestPointerLock.call(document.body);
                                console.log("Pointer lock requested after 200ms delay for browser compatibility.");
                            }
                        }, 200); // CRUCIAL: ~150-200ms delay
                    } else {
                        // For mobile, just hide the overlay
                        this.resumeOverlayElement.style.display = 'none';
                    }
                }
            });
        }
        
        // Handle pointer lock change (desktop only)
        if (!this.isMobile) {
            document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
            document.addEventListener('mozpointerlockchange', this.handlePointerLockChange.bind(this));
            document.addEventListener('webkitpointerlockchange', this.handlePointerLockChange.bind(this));
        }
        
        // Add touch event listeners for mobile
        if (this.isMobile) {
            // Prevent default touch actions to avoid browser gestures
            document.addEventListener('touchmove', (e) => {
                if (this.currentState === GameState.PLAYING) {
                    e.preventDefault();
                }
            }, { passive: false });
            
            // Prevent zoom on double tap
            let lastTap = 0;
            document.addEventListener('touchend', (e) => {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 500 && tapLength > 0) {
                    e.preventDefault();
                }
                lastTap = currentTime;
            });
        }
    }
    
    handlePointerLockChange() {
        if (!this.resumeOverlayElement || this.isMobile) return; // safety check or skip on mobile
    
        if (document.pointerLockElement === document.body) {
            console.log("✅ Pointer lock re-engaged successfully.");
            this.resumeOverlayElement.style.display = 'none';
        } else {
            console.log("⚠️ Pointer lock lost or failed.");
            if (this.currentState === GameState.PLAYING) {
                this.resumeOverlayElement.style.display = 'flex';
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
    
    // Check if device is mobile
    isMobileDevice() {
        return this.isMobile;
    }
}

// Create and export a singleton instance
const uiManager = new UIManager();
export default uiManager; 