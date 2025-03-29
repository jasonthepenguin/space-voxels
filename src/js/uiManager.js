// UI Manager with State Machine Pattern
import * as THREE from 'three';
import { hideChat, showChat } from './chat.js';

// Game States
export const GameState = {
    USERNAME_INPUT: 'USERNAME_INPUT',
    MAIN_MENU: 'MAIN_MENU',
    SHIP_SELECTOR: 'SHIP_SELECTOR',
    PLAYING: 'PLAYING'
};

class UIManager {
    constructor() {
        // Current game state
        this.currentState = GameState.USERNAME_INPUT;
        
        // Player username
        this.username = '';
        
        // Selected ship (default to the first ship)
        this.selectedShip = 'default';
        
        // UI Elements
        this.usernameInputScreenElement = document.getElementById('username-input-screen');
        this.usernameInputElement = document.getElementById('username-input');
        this.usernameErrorElement = document.getElementById('username-error');
        this.usernameSubmitButton = document.getElementById('username-submit-button');
        this.instructionsElement = document.getElementById('instructions');
        this.shipSelectorElement = document.getElementById('ship-builder-ui');
        this.crosshairElement = document.getElementById('crosshair');
        this.fpsCounterElement = document.getElementById('fps-counter');
        this.playersCounterElement = document.getElementById('players-counter');
        this.resumeOverlayElement = document.getElementById('resume-overlay');
        this.mobileControlsElement = document.getElementById('mobile-controls');
        
        // Buttons
        this.startButton = document.getElementById('start-button');
        this.shipSelectorButton = document.getElementById('ship-builder-button');
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
        
        // Add a container for elimination messages
        this.eliminationContainer = document.createElement('div');
        this.eliminationContainer.id = 'elimination-container';
        document.body.appendChild(this.eliminationContainer);
        
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
        this.changeState(this.currentState);
        
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
        
        if (this.shipSelectorButton) {
            this.shipSelectorButton.style.padding = '15px 40px';
            this.shipSelectorButton.style.margin = '15px 0';
            this.shipSelectorButton.style.fontSize = '18px';
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
        
        // Hide all major UI sections first
        this.usernameInputScreenElement.style.display = 'none';
        this.instructionsElement.style.display = 'none';
        this.shipSelectorElement.style.display = 'none';
        this.crosshairElement.style.display = 'none';
        this.playersCounterElement.style.display = 'none';
        if (this.resumeOverlayElement) this.resumeOverlayElement.style.display = 'none';
        if (this.mobileControlsElement) this.mobileControlsElement.style.display = 'none';
        if (!this.isMobile) hideChat(); // Hide chat by default
        
        // Handle UI changes based on state transition
        switch (newState) {
            case GameState.USERNAME_INPUT:
                this.usernameInputScreenElement.style.display = 'block';
                // Ensure chat is hidden
                if (!this.isMobile) hideChat();
                break;
                
            case GameState.MAIN_MENU:
                this.instructionsElement.style.display = 'block';
                this.shipSelectorElement.style.display = 'none';
                this.crosshairElement.style.display = 'none';
                this.playersCounterElement.style.display = 'none';
                if (this.resumeOverlayElement) {
                    this.resumeOverlayElement.style.display = 'none';
                }
                if (this.mobileControlsElement) {
                    this.mobileControlsElement.style.display = 'none';
                }
                
                // Hide chat when returning to main menu
                if (!this.isMobile) {
                    hideChat();
                }
                break;
                
            case GameState.SHIP_SELECTOR:
                this.instructionsElement.style.display = 'none';
                this.shipSelectorElement.style.display = 'block';
                this.crosshairElement.style.display = 'none';
                this.playersCounterElement.style.display = 'none';
                if (this.resumeOverlayElement) {
                    this.resumeOverlayElement.style.display = 'none';
                }
                if (this.mobileControlsElement) {
                    this.mobileControlsElement.style.display = 'none';
                }
                
                // Hide chat in ship selector
                if (!this.isMobile) {
                    hideChat();
                }
                break;
                
            case GameState.PLAYING:
                this.instructionsElement.style.display = 'none';
                this.shipSelectorElement.style.display = 'none';
                this.crosshairElement.style.display = 'block';
                this.playersCounterElement.style.display = 'block';
                if (this.resumeOverlayElement) {
                    this.resumeOverlayElement.style.display = 'none';
                }
                
                // Only show chat for desktop users
                if (!this.isMobile) {
                    showChat();
                }
                
                // Only request pointer lock on desktop
                if (!this.isMobile) {
                    document.body.requestPointerLock = document.body.requestPointerLock || 
                                                    document.body.mozRequestPointerLock ||
                                                    document.body.webkitRequestPointerLock;
                    document.body.requestPointerLock();
                }
                
                // Call the game start callback
                if (this.gameStartCallback && (prevState === GameState.MAIN_MENU || prevState === GameState.USERNAME_INPUT)) {
                    this.gameStartCallback(this.username); // Pass username
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
        
        // Username Submit button
        this.usernameSubmitButton.addEventListener('click', () => {
            this.validateAndSetUsername();
        });
        // Also allow submitting with Enter key
        this.usernameInputElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                this.validateAndSetUsername();
            }
        });
        
        // Ship selector button
        this.shipSelectorButton.addEventListener('click', () => {
            if (this.camera && this.currentState === GameState.MAIN_MENU && !this.isAnimating) {
                this.startCameraRotation(180, () => {
                    this.changeState(GameState.SHIP_SELECTOR);
                });
            }
        });
        
        // Return button
        this.returnButton.addEventListener('click', () => {
            if (this.camera && this.currentState === GameState.SHIP_SELECTOR && !this.isAnimating) {
                this.startCameraRotation(180, () => {
                    this.changeState(GameState.MAIN_MENU);
                });
            }
        });
        
        // Ship option selection
        const shipOptions = document.querySelectorAll('.ship-option');
        shipOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove selected class from all options
                shipOptions.forEach(opt => opt.style.backgroundColor = 'rgba(255, 255, 255, 0.1)');
                
                // Add selected class to clicked option
                option.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                
                // Add a subtle glow effect to the selected ship image
                const images = document.querySelectorAll('.ship-option img');
                images.forEach(img => {
                    img.style.boxShadow = 'none';
                });
                
                const selectedImage = option.querySelector('img');
                if (selectedImage) {
                    selectedImage.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.8)';
                }
                
                // Store selected ship
                const shipName = option.querySelector('span').textContent;
                this.selectedShip = shipName === 'Default Ship' ? 'default' : shipName;
                console.log(`Selected ship: ${this.selectedShip}`);
            });
            
            // Add hover effect
            option.addEventListener('mouseenter', () => {
                if (option.style.backgroundColor !== 'rgba(255, 255, 255, 0.3)') {
                    option.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                }
            });
            
            option.addEventListener('mouseleave', () => {
                if (option.style.backgroundColor !== 'rgba(255, 255, 255, 0.3)') {
                    option.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }
            });
        });
        
        // Set default ship as selected in the UI
        const defaultShipOption = Array.from(shipOptions).find(option => 
            option.querySelector('span').textContent === 'Default Ship'
        );
        
        if (defaultShipOption) {
            defaultShipOption.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            
            const selectedImage = defaultShipOption.querySelector('img');
            if (selectedImage) {
                selectedImage.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.8)';
            }
            
            this.selectedShip = 'default';
        }
        
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
    
        // Only show overlay if pointer lock is lost during PLAYING state
        if (document.pointerLockElement !== document.body && this.currentState === GameState.PLAYING) {
            console.log("⚠️ Pointer lock lost or failed.");
            this.resumeOverlayElement.style.display = 'flex';
        } else if (document.pointerLockElement === document.body) {
            console.log("✅ Pointer lock re-engaged successfully.");
            this.resumeOverlayElement.style.display = 'none';
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
        if (this.shipSelectorButton) this.shipSelectorButton.disabled = true;
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
                if (this.shipSelectorButton) this.shipSelectorButton.disabled = false;
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
    
    // Get selected ship
    getSelectedShip() {
        return this.selectedShip;
    }
    
    // Check if game is in playing state
    isPlaying() {
        return this.currentState === GameState.PLAYING;
    }
    
    // Check if device is mobile
    isMobileDevice() {
        return this.isMobile;
    }
    
    // Add a new method to show elimination message
    showEliminationMessage(points = 100) {
        // Add screen flash effect
        this.showScreenFlash();
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'elimination-message';
        messageElement.innerHTML = `<span>Player Molested!</span> <span class="points">+${points}</span>`;
        
        // Add to container
        this.eliminationContainer.appendChild(messageElement);
        
        // Create a random rotation for added intensity
        const randomRotation = Math.random() * 6 - 3; // Between -3 and +3 degrees
        
        // Trigger animation with more intense effects
        setTimeout(() => {
            messageElement.classList.add('show');
            messageElement.style.transform = `translateY(0) scale(1.1) rotate(${randomRotation}deg)`;
            
            // Add shake animation
            messageElement.style.animation = 'message-shake 0.1s ease-in-out alternate infinite';
            
            // Remove after animation completes with more dramatic exit
            setTimeout(() => {
                messageElement.classList.add('fade-out');
                messageElement.style.animation = '';
                messageElement.style.transform = `translateY(-30px) scale(1.3) rotate(${-randomRotation * 2}deg)`;
                
                setTimeout(() => {
                    this.eliminationContainer.removeChild(messageElement);
                }, 600); // Slightly longer fade out duration
            }, 1800); // Show a bit longer before fading
        }, 10); // Small delay to ensure DOM is updated
    }
    
    // Add this method to the UIManager class
    showScreenFlash() {
        // Create a full-screen flash element
        const flashElement = document.createElement('div');
        flashElement.className = 'screen-flash';
        document.body.appendChild(flashElement);
        
        // Trigger the flash animation
        setTimeout(() => {
            flashElement.classList.add('active');
            
            // Remove after animation completes
            setTimeout(() => {
                document.body.removeChild(flashElement);
            }, 300); // Flash duration
        }, 10);
    }
    
    // Add this method to create a boost overlay for motion blur effect
    createBoostOverlay() {
        // Check if overlay already exists
        if (window.boostOverlay) return window.boostOverlay;
        
        const overlay = document.createElement('div');
        overlay.id = 'boost-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'radial-gradient(circle, transparent 60%, rgba(255,255,255,0.3) 100%)';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '90';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(overlay);
        window.boostOverlay = overlay;
        return overlay;
    }
    
    // Add this method to create speed lines for boost effect
    createSpeedLine() {
        const line = document.createElement('div');
        line.className = 'speed-line';
        
        // Random position and size
        const y = Math.random() * window.innerHeight;
        const width = 20 + Math.random() * 100;
        const height = 1 + Math.random() * 2;
        
        line.style.top = `${y}px`;
        line.style.width = `${width}px`;
        line.style.height = `${height}px`;
        line.style.left = `${Math.random() * 20}%`;
        
        // Random rotation for more dynamic effect
        const angle = -10 + Math.random() * 20;
        line.style.transform = `rotate(${angle}deg)`;
        
        document.body.appendChild(line);
        
        // Remove the line after animation completes
        setTimeout(() => {
            if (line.parentNode) {
                line.parentNode.removeChild(line);
            }
        }, 500);
    }
    
    // Validate and set username
    validateAndSetUsername() {
        const username = this.usernameInputElement.value.trim();
        const errorElement = this.usernameErrorElement;
        const inputElement = this.usernameInputElement;
        const regex = /^[a-zA-Z0-9]+$/; // Alphanumeric only

        errorElement.textContent = ''; // Clear previous errors
        inputElement.style.borderColor = 'rgba(255, 255, 255, 0.3)'; // Reset border
        inputElement.style.animation = ''; // Clear shake animation

        if (!username) {
            errorElement.textContent = 'Username cannot be empty.';
            inputElement.style.borderColor = '#ff6b6b';
            inputElement.style.animation = 'shake 0.5s ease-in-out';
            return;
        }

        if (username.length > 10) {
            // Should be prevented by maxlength, but good to double check
            errorElement.textContent = 'Username must be 10 characters or less.';
            inputElement.style.borderColor = '#ff6b6b';
            inputElement.style.animation = 'shake 0.5s ease-in-out';
            return;
        }

        if (!regex.test(username)) {
            errorElement.textContent = 'Only letters and numbers allowed.';
            inputElement.style.borderColor = '#ff6b6b';
            inputElement.style.animation = 'shake 0.5s ease-in-out';
            return;
        }

        // Validation passed
        this.username = username;
        console.log(`Username set to: ${this.username}`);
        this.changeState(GameState.MAIN_MENU);
    }
    
    // Get the stored username
    getUsername() {
        return this.username;
    }

    showServerFullError() {
        this.usernameErrorElement.textContent = "Server is full. Please try again later. Sorry :(";
        this.usernameInputElement.disabled = true;
        this.usernameSubmitButton.disabled = true;
    }
}

// Create and export a singleton instance
const uiManager = new UIManager();
export default uiManager; 