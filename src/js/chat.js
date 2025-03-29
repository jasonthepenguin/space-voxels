// Chat System Module

// Maximum number of messages to display
const MAX_MESSAGES = 7;

// Chat state
let isChatActive = false;
let chatMessages = [];
let chatUsername = 'Player'; // Default username
let socket = null;

// DOM elements
let chatContainer = null;
let chatMessagesElement = null;
let chatInputElement = null;

// Spam protection
let lastChatTime = 0;
const CHAT_COOLDOWN_MS = 1000; // Match server cooldown

/**
 * Initialize the chat system
 * @param {Object} socketInstance - Socket.io instance for sending messages
 * @param {String} username - Username for the chat
 */
export function initChat(socketInstance, username = 'Player') {
    // Get DOM elements
    chatContainer = document.getElementById('chat-container');
    chatMessagesElement = document.getElementById('chat-messages');
    chatInputElement = document.getElementById('chat-input');
    
    // Set socket and username
    socket = socketInstance;
    if (username) chatUsername = username;
    
    // Setup socket event listener for incoming messages
    if (socket) {
        socket.on('chatMessage', (data) => {
            // Check if this message is from the current user
            if (data.senderId === socket.id) {
                // Skip messages from ourselves as we've already added them locally
                console.log('Skipping own message from server');
                return;
            }
            
            // Add message from other users
            addMessage(data.username, data.message);
        });
    }
    
    // Setup input event listeners
    setupInputListeners();
    
    // Initially show the chat container
    if (chatContainer) {
        chatContainer.style.display = 'flex';
    }
    
    console.log('Chat system initialized');
}

/**
 * Setup chat input event listeners
 */
function setupInputListeners() {
    if (!chatInputElement) return;
    
    chatInputElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            // Send message and deactivate chat when Enter is pressed
            sendMessage();
            event.preventDefault();
        }
        
        if (event.key === 'Escape') {
            // Just deactivate chat when Escape is pressed
            deactivateChat();
            event.preventDefault();
        }
        
        // Prevent tab from changing focus - could be used for player name completion in the future
        if (event.key === 'Tab') {
            event.preventDefault();
            // Future feature: cycle through player names for direct messaging
        }
    });
    
    chatInputElement.addEventListener('blur', () => {
        // This ensures chat is deactivated when clicking elsewhere
        deactivateChat();
    });
}

/**
 * Activate the chat input
 */
export function activateChat() {
    if (!chatContainer || isChatActive) return;
    
    isChatActive = true;
    
    // Show chat elements
    chatContainer.style.display = 'flex';
    chatInputElement.style.display = 'block';
    
    // Add active class for visual feedback
    chatContainer.classList.add('chat-active');
    
    // Focus the input
    chatInputElement.focus();
}

/**
 * Deactivate the chat input
 */
export function deactivateChat() {
    if (!chatContainer || !isChatActive) return;
    
    isChatActive = false;
    
    // Hide input but keep messages visible
    chatInputElement.style.display = 'none';
    chatInputElement.value = '';
    
    // Remove active class
    chatContainer.classList.remove('chat-active');
    
    // Always keep the container visible - removed code that hides it
    
    // Re-request pointer lock on desktop to resume gameplay smoothly
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (window.innerWidth <= 800 && window.innerHeight <= 900);
    
    if (!isMobile && document.body.requestPointerLock) {
        // Slight delay to reliably regain pointer lock
        setTimeout(() => {
            document.body.requestPointerLock();
        }, 10);
    }
}

/**
 * Send a chat message
 */
function sendMessage() {

    const now = Date.now();
    if (now - lastChatTime < CHAT_COOLDOWN_MS) {
        console.log('Client-side chat cooldown active.');
        return;
    }


    const message = chatInputElement.value.trim();

    if(!message)
    {
        deactivateChat();
        return;
    }
    
    // Add message locally
    addMessage(chatUsername, message);
    
    // Send message to server
    if (socket) {
        socket.emit('chatMessage', {
            username: chatUsername,
            message: message
        });
    }
    
    // Clear input
    chatInputElement.value = '';
    
    // Deactivate chat after sending message to return to gameplay
    deactivateChat();
}

/**
 * Add a message to the chat
 * @param {String} username - Username of the sender
 * @param {String} message - Message content
 */
function addMessage(username, message) {
    // Create message object
    const messageObj = {
        username: username,
        message: message,
        timestamp: new Date()
    };
    
    // Add to messages array
    chatMessages.push(messageObj);
    
    // Limit to MAX_MESSAGES
    if (chatMessages.length > MAX_MESSAGES) {
        chatMessages = chatMessages.slice(chatMessages.length - MAX_MESSAGES);
    }
    
    // Update UI
    updateChatUI();
    
    // Chat container is always visible - no need to check/change display
}

/**
 * Update the chat UI with current messages
 */
function updateChatUI() {
    if (!chatMessagesElement) return;
    
    // Clear current messages
    chatMessagesElement.innerHTML = '';
    
    // Add all messages
    chatMessages.forEach(messageObj => {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        const usernameElement = document.createElement('span');
        usernameElement.className = 'chat-username';
        usernameElement.textContent = messageObj.username + ':';
        
        const messageContentElement = document.createElement('span');
        messageContentElement.className = 'chat-content';
        messageContentElement.textContent = ' ' + messageObj.message;
        
        messageElement.appendChild(usernameElement);
        messageElement.appendChild(messageContentElement);
        
        chatMessagesElement.appendChild(messageElement);
    });
    
    // Scroll to bottom
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

/**
 * Check if chat is currently active
 * @returns {Boolean} - True if chat is active
 */
export function isChatInputActive() {
    return isChatActive;
}

/**
 * Set the username for chat
 * @param {String} username - New username
 */
export function setUsername(username) {
    if (username) chatUsername = username;
}

/**
 * Show the chat UI
 */
export function showChat() {
    if (!chatContainer) return;
    // Always show the chat container regardless of message count
    chatContainer.style.display = 'flex';
}

/**
 * Hide the chat UI completely
 */
export function hideChat() {
    if (!chatContainer) return;
    chatContainer.style.display = 'none';
    deactivateChat();
}
