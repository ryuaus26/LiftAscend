

class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.initializeFirebase();
        this.setupEventListeners();
        this.loadInitialHistory();
    }
    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    initializeFirebase() {
        if (!firebase.apps.length) {
            throw new Error('Firebase must be initialized before creating ChatWidget');
        }
        this.auth = firebase.auth();
        this.database = firebase.database();
        
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.loadChatHistory();
            } else {
                this.clearChat();
            }
        });
    }

    async loadInitialHistory() {
        if (this.auth.currentUser) {
            await this.loadChatHistory();
        } else {
            this.loadLocalMessages();
        }
    }

    setupEventListeners() {
        const chatWidget = document.querySelector('.chat-widget');
        const chatButton = document.getElementById('chatButton');
        const chatForm = document.getElementById('chatForm');
        const chatInput = document.getElementById('chatInput');
        const sendMessage = document.getElementById('sendMessage');
        const typingIndicator = document.getElementById('typingIndicator');

        chatButton.addEventListener('click', (event) => {
            const user = firebase
            event.stopPropagation();
            
            this.toggleChat();
        });

        sendMessage.addEventListener('click', () => this.sendMessage());

        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.sendMessage();
            }
        });

        document.addEventListener('click', (event) => {
            const isClickInsideWidget = chatWidget.contains(event.target);
            if (!isClickInsideWidget) {
                this.closeChat();
            }
        });

        chatInput.addEventListener('input', () => {
            sendMessage.disabled = chatInput.value.trim() === '';
        });

        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
    }

    async saveUserRequest(message) {
        const user = this.auth.currentUser;
        if (!user) {
            console.error('No user logged in');
            this.saveToLocalStorage({
                message: message,
                timestamp: Date.now(),
                type: 'user'
            });
            return;
        }

        const uid = user.uid;
        const messageData = {
            message: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            userId: uid,
            status: 'pending',
            type: 'user'
        };

        try {
            const newMessageRef = await this.database.ref('users/' + uid + '/chatHistory').push(messageData);
            messageData.id = newMessageRef.key;
            this.messages.push(messageData);
            return messageData;
        } catch (error) {
            console.error('Error saving message:', error);
            this.saveToLocalStorage(messageData);
            this.addSystemMessage('Message saved locally - Will sync when online');
            return messageData;
        }
    }

    async saveSystemResponse(response, userMessageId) {
        const user = this.auth.currentUser;
        if (!user) return;

        const responseData = {
            message: response,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            userId: user.uid,
            type: 'system',
            replyTo: userMessageId
        };

        try {
            await this.database.ref('users/' + user.uid + '/chatHistory').push(responseData);
            this.messages.push(responseData);
        } catch (error) {
            console.error('Error saving system response:', error);
            this.saveToLocalStorage(responseData);
        }
    }

    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();

        if (message === '') return;

        if (!this.auth.currentUser) {
            this.addSystemMessage('Please log in to send messages');
            return;
        }

        const userMessageData = await this.saveUserRequest(message);
        this.addUserMessage(message);
        chatInput.value = '';
        document.getElementById('sendMessage').disabled = true;

        const typingIndicator = document.getElementById('typingIndicator');
        typingIndicator.style.display = 'block';

        try {
            const responseMessage = await this.sendToFirebaseFunction(message);
            if (responseMessage) {
                await this.saveSystemResponse(responseMessage, userMessageData.id);
                this.addSystemMessage(responseMessage);
            }
        } finally {
            typingIndicator.style.display = 'none';
            document.getElementById('sendMessage').disabled = false;
        }
    }

    async sendToFirebaseFunction(userMessage) {
        try {
            const apiKeyRef = this.database.ref('APIKEY');
            const snapshot = await apiKeyRef.once('value');
            const apiKey = snapshot.val();
    
            if (!apiKey) {
                console.error('API key not found in Firebase for user:', user.uid);
                return null;
            }
    
            const url = "https://api.openai.com/v1/chat/completions";
            const bearer = 'Bearer ' + apiKey;
    
           

            const response = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: bearer,
                },
                method: "POST",
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "This is a powerlifting coach chatbot and you sound like an enthusiastic human. You should help the user with their powerlifting questions, and ignore all unrelated questions."
                        },
                        {
                            role: "user",
                            content: userMessage
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                }),
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error from OpenAI API:', errorData);
                return null;
            }
    
            const data = await response.json();
            return data.choices[0].message.content;
    
        } catch (error) {
            console.error('Error connecting to OpenAI API:', error);
            return null;
        }
    }

    async loadChatHistory() {
        const user = this.auth.currentUser;
        if (!user) return;
    
        try {
            const snapshot = await this.database.ref('users/' + user.uid + '/chatHistory')
                .orderByChild('timestamp')
                .limitToLast(50)
                .once('value');
    
            const chatHistory = snapshot.val();
            if (chatHistory) {
                this.messages = Object.entries(chatHistory).map(([key, value]) => ({
                    ...value,
                    id: key
                }));
                this.messages.sort((a, b) => a.timestamp - b.timestamp);
                
                // Clear existing messages
                const chatMessages = document.getElementById('chatMessages');
                chatMessages.innerHTML = '';
                
                // Use Promise.all to wait for all messages to be rendered
                await Promise.all(this.messages.map(message => {
                    return new Promise(resolve => {
                        const messageElement = document.createElement('div');
                        messageElement.className = `message ${message.type === 'user' ? 'user' : 'system'}`;
                        messageElement.textContent = message.message;
                        messageElement.setAttribute('data-message-id', message.id || '');
                        
                        // Wait for images or other resources to load
                        messageElement.addEventListener('load', () => resolve(), true);
                        
                        chatMessages.appendChild(messageElement);
                        // Resolve immediately if no resources need to be loaded
                        resolve();
                    });
                }));
                
                // Ensure scroll happens after all messages are rendered
                requestAnimationFrame(() => {
                    this.scrollToBottom();
                });
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.loadLocalMessages();
        }
    }
    

    toggleChat() {
        const chatForm = document.getElementById('chatForm');
        const chatButton = document.getElementById('chatButton');

        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            chatForm.classList.add('active');
            chatButton.classList.add('active');
            document.getElementById('chatInput').focus();
        } else {
            chatForm.classList.remove('active');
            chatButton.classList.remove('active');
        }
    }

    closeChat() {
        if (this.isOpen) {
            const chatForm = document.getElementById('chatForm');
            const chatButton = document.getElementById('chatButton');

            this.isOpen = false;
            chatForm.classList.remove('active');
            chatButton.classList.remove('active');
        }
    }

    addUserMessage(text) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'message user';
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    addSystemMessage(text) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    displayMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';

        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.type === 'user' ? 'user' : 'system'}`;
            messageElement.textContent = message.message;
            messageElement.setAttribute('data-message-id', message.id || '');
            chatMessages.appendChild(messageElement);
        });

        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
            this.scrollToBottom();
        });
    }

    saveToLocalStorage(messageData) {
        try {
            const localMessages = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            localMessages.push(messageData);
            localMessages.sort((a, b) => a.timestamp - b.timestamp);
            localStorage.setItem('chatHistory', JSON.stringify(localMessages));
        } catch (error) {
            console.error('Local storage error:', error);
        }
    }

    loadLocalMessages() {
        try {
            const localMessages = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            if (localMessages.length > 0) {
                this.displayMessages(localMessages);
            }
        } catch (error) {
            console.error('Error loading local messages:', error);
        }
    }

    handleOnlineStatus(isOnline) {
        const status = isOnline ? 'Connected' : 'Offline - Messages will be saved locally';
        this.addSystemMessage(status);
    }

    
    clearChat() {
        this.messages = [];
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
    }
}

// Initialize the chat widget when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Sign in anonymously (or implement your own auth logic)
    
        const chatWidget = new ChatWidget();
        chatWidget.scrollToBottom()
})
