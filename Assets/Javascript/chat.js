class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.initializeFirebase();
        this.setupEventListeners();
        this.loadInitialHistory();
    }

    // Scrolls the chat to the bottom
    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Initializes Firebase
    initializeFirebase() {
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: "YOUR_FIREBASE_API_KEY",
                authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
                databaseURL: "YOUR_FIREBASE_DATABASE_URL",
                projectId: "YOUR_FIREBASE_PROJECT_ID",
                storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
                messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
                appId: "YOUR_FIREBASE_APP_ID"
            });
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

    // Sets up event listeners for various UI elements
    setupEventListeners() {
        const chatWidget = document.querySelector('.chat-widget');
        const chatButton = document.getElementById('chatButton');
        const chatForm = document.getElementById('chatForm');
        const chatInput = document.getElementById('chatInput');
        const sendMessage = document.getElementById('sendMessage');
        const typingIndicator = document.getElementById('typingIndicator');
        const closeChatButton = document.getElementById('closeChatButton');
        const uploadButton = document.getElementById('uploadButton');
        const fileInput = document.getElementById('fileInput');

        // Toggle chat visibility
        chatButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleChat();
        });

        // Close chat when clicking the close button
        if (closeChatButton) {
            closeChatButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.closeChat();
            });
        }

        // Send message on button click
        sendMessage.addEventListener('click', () => this.sendMessage());

        // Send message on Enter key press
        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.sendMessage();
            }
        });

        // Close chat when clicking outside the widget
        document.addEventListener('click', (event) => {
            const isClickInsideWidget = chatWidget.contains(event.target);
            if (!isClickInsideWidget) {
                this.closeChat();
            }
        });

        // Enable/disable send button based on input
        chatInput.addEventListener('input', () => {
            sendMessage.disabled = chatInput.value.trim() === '';
        });

        // Handle online/offline status
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));

        // Setup drag and drop for file uploads
        this.setupDragAndDropListeners();

        // File upload handling
        uploadButton.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    this.handleFile(files[i]);
                }
            }
        });
    }

    // Sets up drag and drop listeners for file uploads
    setupDragAndDropListeners() {
        const chatInputContainer = document.getElementById('chatInputContainer');

        chatInputContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInputContainer.classList.add('dragover');
        });

        chatInputContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInputContainer.classList.remove('dragover');
        });

        chatInputContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInputContainer.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    this.handleFile(files[i]);
                }
            }
        });
    }

    // Processes image files for GPT analysis
    // Processes image files for GPT analysis
    async processImageURLForGPT(imageURL, fileName) {
        try {
            this.showTypingIndicator(true);
    
            const apiKeyRef = this.database.ref('APIKEY');
            const snapshot = await apiKeyRef.once('value');
            const apiKey = snapshot.val();
    
            if (!apiKey) {
                throw new Error('API key not found');
            }
    
            // Construct the messages array per your doc example
            const messages = [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: "What's in this image?"
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageURL // Our new public URL from Firebase
                            }
                        }
                    ]
                }
            ];
    
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o', // or whichever model supports image_url
                    messages: messages,
                    max_tokens: 300
                })
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error processing image');
            }
    
            const data = await response.json();
            const gptResponse = data.choices[0].message.content;
    
            // Save + Display the analysis
            await this.saveImageAnalysis(fileName, gptResponse);
            this.addSystemMessage(gptResponse);
    
        } catch (error) {
            console.error('Error processing image URL:', error);
            this.addSystemMessage('Sorry, there was an error analyzing the image. Please try again.');
        } finally {
            this.showTypingIndicator(false);
        }
    }
    
      

    // Converts an image file to a Base64 string
    async convertImageToBase64(imageFile) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(imageFile); // returns data:*/*;base64, ...
        });
      }
      

    // Handles uploaded files (images or text)
    // Handles uploaded files (images or text)
      // In ChatWidget class:
handleFile(file) {
    const allowedTypes = ['image/png', 'image/jpeg', 'text/plain', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        this.displayMessage(`Unsupported file type: ${file.name}. Please upload an image or a text file.`, 'bot');
        return;
    }

    const chatMessages = document.getElementById('chatMessages');
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message system';

    if (file.type.startsWith('image/')) {
        // 1) Upload to Firebase Storage
        this.uploadImageToFirebase(file)
            .then((downloadURL) => {
                // 2) Show the uploaded image in chat using the public URL
                messageContainer.innerHTML = `
                    <div class="message-content">
                        <p>📸 Image uploaded: ${file.name}</p>
                        <div class="image-preview-container">
                            <img src="${downloadURL}" alt="Image Preview" class="chat-image-preview">
                        </div>
                    </div>
                `;
                chatMessages.appendChild(messageContainer);
                this.scrollToBottom();

                // 3) Pass that URL to GPT
                this.processImageURLForGPT(downloadURL, file.name);
            })
            .catch((error) => {
                console.error('Error uploading image to Firebase:', error);
                this.addSystemMessage(`Could not upload ${file.name} to Firebase Storage.`);
            });

    } else if (file.type === 'text/plain') {
        // Text files remain the same
        const reader = new FileReader();
        reader.onload = (e) => {
            const textContent = e.target.result.length > 100
                ? e.target.result.substring(0, 100) + '...'
                : e.target.result;
            messageContainer.innerHTML = `
                <div class="message-content">
                    <p>📄 Text file uploaded: ${file.name}</p>
                    <pre class="text-preview">${textContent}</pre>
                </div>
            `;
            chatMessages.appendChild(messageContainer);
            this.scrollToBottom();
        };
        reader.readAsText(file);
    }
}


async uploadImageToFirebase(file) {
    // Create a reference to your bucket
    const storageRef = firebase.storage().ref();
  
    // Construct a unique path for the image (optional, but recommended)
    const uniqueFileName = `images/${Date.now()}_${file.name}`; // e.g. "images/1692815534000_myImage.png"
  
    // Create a reference inside Storage
    const fileRef = storageRef.child(uniqueFileName);
  
    // Upload the file
    const snapshot = await fileRef.put(file);
  
    // Get the public download URL
    const downloadURL = await snapshot.ref.getDownloadURL();
  
    return downloadURL;
  }
  

    // Sends a user message
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
            const responseMessage = await this.sendToOpenAIAPI(message);
            if (responseMessage) {
                await this.saveSystemResponse(responseMessage, userMessageData ? userMessageData.id : null);
                this.addSystemMessage(responseMessage);
            }
        } finally {
            typingIndicator.style.display = 'none';
            document.getElementById('sendMessage').disabled = false;
        }
    }

    // Sends a message to the OpenAI API
   // Sends a message to the OpenAI API
async sendToOpenAIAPI(userMessage) {
    try {
        const apiKeyRef = this.database.ref('APIKEY');
        const snapshot = await apiKeyRef.once('value');
        const apiKey = snapshot.val();

        if (!apiKey) {
            console.error('API key not found in Firebase');
            return null;
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            method: "POST",
            body: JSON.stringify({
                model: "gpt-4o", // Corrected model name
                messages: [
                    {
                        role: "system",
                        content: "You are a powerlifting coach chatbot and you sound like an enthusiastic human. You should help the user with their powerlifting questions and ignore all unrelated questions."
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


    // Saves the image analysis result to Firebase
    async saveImageAnalysis(imageName, analysis) {
        const user = this.auth.currentUser;
        if (!user) {
            this.saveToLocalStorage({
                message: `Image Analysis (${imageName}): ${analysis}`,
                timestamp: Date.now(),
                type: 'system'
            });
            return;
        }

        const analysisData = {
            message: analysis,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            userId: user.uid,
            type: 'system',
            imageAnalysis: true,
            imageName: imageName
        };

        try {
            await this.database.ref('users/' + user.uid + '/chatHistory').push(analysisData);
            this.messages.push(analysisData);
        } catch (error) {
            console.error('Error saving image analysis:', error);
            this.saveToLocalStorage({
                message: `Image Analysis (${imageName}): ${analysis}`,
                timestamp: Date.now(),
                type: 'system'
            });
        }
    }

    // Saves the user request to Firebase
    async saveUserRequest(message) {
        const user = this.auth.currentUser;
        if (!user) {
            console.error('No user logged in');
            this.saveToLocalStorage({
                message: message,
                timestamp: Date.now(),
                type: 'user'
            });
            return null;
        }

        const messageData = {
            message: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            userId: user.uid,
            status: 'pending',
            type: 'user'
        };

        try {
            const newMessageRef = await this.database.ref('users/' + user.uid + '/chatHistory').push(messageData);
            messageData.id = newMessageRef.key;
            this.messages.push(messageData);
            return messageData;
        } catch (error) {
            console.error('Error saving message:', error);
            this.saveToLocalStorage({
                message: message,
                timestamp: Date.now(),
                type: 'user'
            });
            this.addSystemMessage('Message saved locally - Will sync when online');
            return null;
        }
    }

    // Saves the system response to Firebase
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
            this.saveToLocalStorage({
                message: response,
                timestamp: Date.now(),
                type: 'system',
                replyTo: userMessageId
            });
        }
    }

    // Loads the chat history from Firebase
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

                const chatMessages = document.getElementById('chatMessages');
                chatMessages.innerHTML = '';

                this.messages.forEach(message => {
                    if (message.type === 'user') {
                        this.addUserMessage(message.message);
                    } else if (message.type === 'system') {
                        this.addSystemMessage(message.message);
                    }
                });

                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.loadLocalMessages();
        }
    }

    // Loads initial chat history and sends the welcome message
    async loadInitialHistory() {
        if (this.auth.currentUser) {
            await this.loadChatHistory();
            this.sendInitialWelcomeMessage();
        } else {
            this.loadLocalMessages();
            this.sendInitialWelcomeMessage();
        }
    }

    // Sends the initial welcome message
    async sendInitialWelcomeMessage() {
        const initialMessage = "Welcome to your Powerlifting Coach! I'm here to help you improve your strength training. What lifting goals can I assist you with today?";

        // Add system message
        this.addSystemMessage(initialMessage);

        // Try to get an AI-generated response to the initial message
        try {
            const responseMessage = await this.sendToOpenAIAPI(initialMessage);
            if (responseMessage) {
                await this.saveSystemResponse(responseMessage, null);
                this.addSystemMessage(responseMessage);
            }
        } catch (error) {
            console.error('Error generating initial response:', error);
        }
    }

    // Toggles the chat window open or closed
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

    // Closes the chat window
    closeChat() {
        if (this.isOpen) {
            const chatForm = document.getElementById('chatForm');
            const chatButton = document.getElementById('chatButton');

            this.isOpen = false;
            chatForm.classList.remove('active');
            chatButton.classList.remove('active');
        }
    }

    // Adds a user message to the chat
    addUserMessage(text) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'message user';
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    // Adds a system/bot message to the chat
    addSystemMessage(text) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    // Displays a list of messages in the chat
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

    // Saves messages to local storage when offline
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

    // Loads messages from local storage
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

    // Handles online/offline status changes
    handleOnlineStatus(isOnline) {
        const status = isOnline ? 'Connected' : 'Offline - Messages will be saved locally';
        this.addSystemMessage(status);

        if (isOnline) {
            this.syncLocalMessages();
        }
    }

    // Syncs local messages to Firebase when back online
    async syncLocalMessages() {
        try {
            const localMessages = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            if (localMessages.length === 0) return;

            for (const message of localMessages) {
                if (message.type === 'user') {
                    await this.saveUserRequest(message.message);
                } else if (message.type === 'system') {
                    await this.saveSystemResponse(message.message, null);
                }
            }

            localStorage.removeItem('chatHistory');
        } catch (error) {
            console.error('Error syncing local messages:', error);
        }
    }

    // Clears the chat messages
    clearChat() {
        this.messages = [];
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
    }

    // Shows or hides the typing indicator
    showTypingIndicator(show) {
        const typingIndicator = document.getElementById('typingIndicator');
        typingIndicator.style.display = show ? 'block' : 'none';
    }
}

// Initialize the chat widget when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const chatWidget = new ChatWidget();
});
