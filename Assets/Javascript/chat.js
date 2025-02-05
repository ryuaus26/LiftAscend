class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.uploadedImageURL = null; // Add this line
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
        const allowedTypes = [
          'image/png',
          'image/jpeg',
          'text/plain',
          'video/mp4',
          'video/quicktime'
        ];
        
        // Only proceed if file type is supported
        if (!allowedTypes.includes(file.type)) {
          this.addSystemMessage(
            `Unsupported file type: ${file.name}. Please upload an image, text file, or video.`,
          );
          return;
        }
      
        // If it's an image (existing logic)
        if (file.type.startsWith('image/')) {
          this.uploadImageToFirebase(file)
            .then((downloadURL) => {
              // Show the uploaded image in chat
              const chatMessages = document.getElementById('chatMessages');
              const messageContainer = document.createElement('div');
              messageContainer.className = 'message system';
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
      
              // Store just the single URL for analysis
              this.uploadedImageURL = downloadURL;
              this.addSystemMessage(
                'Image uploaded successfully! You can ask me to analyze your form by asking questions like "Is my squat depth good?"'
              );
            })
            .catch((error) => {
              console.error('Error uploading image to Firebase:', error);
              this.addSystemMessage(`Could not upload ${file.name} to Firebase Storage.`);
            });
          return; // Stop here for images
        }
      
        // If it's a text file (existing logic)
        if (file.type === 'text/plain') {
          const reader = new FileReader();
          reader.onload = (e) => {
            const textContent = e.target.result.length > 100
              ? e.target.result.substring(0, 100) + '...'
              : e.target.result;
              
            const chatMessages = document.getElementById('chatMessages');
            const messageContainer = document.createElement('div');
            messageContainer.className = 'message system';
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
          return;
        }
      
        // --- VIDEO HANDLING (Capture ALL FRAMES or Frequent Frames) ---
        if (file.type.startsWith('video/')) {
          const chatMessages = document.getElementById('chatMessages');
      
          // 1) Display some status in chat
          const messageContainer = document.createElement('div');
          messageContainer.className = 'message system';
          messageContainer.innerHTML = `
            <div class="message-content">
              <p>🎥 Video detected: ${file.name}</p>
              <p>Extracting **many frames** from the video. This can take a while.</p>
            </div>
          `;
          chatMessages.appendChild(messageContainer);
          this.scrollToBottom();
      
          // Create a <video> element for processing
          const videoElement = document.createElement('video');
          videoElement.src = URL.createObjectURL(file);
          videoElement.crossOrigin = 'anonymous';
          videoElement.style.display = 'none';
          document.body.appendChild(videoElement);
      
          // A container to show small previews of extracted frames
          const previewContainer = document.createElement('div');
          previewContainer.className = 'message system frames-container';
          previewContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 8px;
            padding: 10px;
            max-height: 70vh;
            overflow-y: auto;
          `;
          chatMessages.appendChild(previewContainer);
      
          // A place to show progress
          const progressContainer = document.createElement('div');
          progressContainer.className = 'message system';
          progressContainer.innerHTML = '<p>Initializing video processing...</p>';
          chatMessages.appendChild(progressContainer);
      
          // We'll store all frames' URLs in an array for context
          this.uploadedFrameURLs = [];
      
          // Wait until the video metadata loads to know the duration
          videoElement.addEventListener('loadedmetadata', async () => {
            const duration = videoElement.duration;
      
            // For example, capture frames ~25 times per second => 0.04
            // (Adjust as needed. If you do literally EVERY frame of 30 fps video, it's huge!)
            const captureInterval = 1 / 5; // ~0.04
      
            // We'll do an asynchronous loop from 0 to the end
            let currentTime = 0;
            let processedFrames = 0;
      
            // Prepare a canvas for drawing frames
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
      
            // We'll set the canvas to the video's resolution
            // (Alternatively, you could scale down for performance)
            let vidWidth = videoElement.videoWidth;
            let vidHeight = videoElement.videoHeight;
            canvas.width = vidWidth;
            canvas.height = vidHeight;
      
            while (currentTime <= duration) {
              await new Promise((resolve) => {
                // Seek to the desired time
                videoElement.currentTime = currentTime;
                
                const onSeeked = async () => {
                  videoElement.removeEventListener('seeked', onSeeked);
      
                  // Draw the frame
                  context.drawImage(videoElement, 0, 0, vidWidth, vidHeight);
      
                  // Convert to Blob (PNG)
                  canvas.toBlob(async (blob) => {
                    if (!blob) {
                      resolve(null);
                      return;
                    }
      
                    // Upload to Firebase
                    const frameFileName = `videoFrames/${Date.now()}_${file.name}_${currentTime.toFixed(2)}.png`;
                    try {
                      const storageRef = firebase.storage().ref();
                      const fileRef = storageRef.child(frameFileName);
                      await fileRef.put(blob);
                      const downloadURL = await fileRef.getDownloadURL();
      
                      // Show in chat (small preview)
                      const frameDiv = document.createElement('div');
                      frameDiv.style.cssText = `
                        border: 1px solid #ccc;
                        padding: 4px;
                        background: white;
                        border-radius: 4px;
                      `;
                      frameDiv.innerHTML = `
                        <img src="${downloadURL}" alt="Frame" 
                             style="width:100%; height:auto; border-radius:4px;"/>
                        <p style="margin:4px 0; font-size:10px; color:#666;">
                          Time: ${currentTime.toFixed(2)}s
                        </p>
                      `;
                      previewContainer.appendChild(frameDiv);
      
                      // Store the URL in an array if you want further reference
                      this.uploadedFrameURLs.push(downloadURL);
      
                      processedFrames++;
                      // Update progress
                      const progressPercent = ((currentTime / duration) * 100).toFixed(1);
                      progressContainer.innerHTML = `<p>Extracting frames: ${progressPercent}% done</p>`;
      
                      if (processedFrames % 5 === 0) {
                        this.scrollToBottom();
                      }
      
                      resolve(downloadURL);
                    } catch (err) {
                      console.error('Error uploading frame:', err);
                      resolve(null);
                    }
                  }, 'image/png', 0.9);
                };
                
                videoElement.addEventListener('seeked', onSeeked, { once: true });
              });
      
              // Go to the next frame time
              currentTime += captureInterval;
            }
      
            // Cleanup
            document.body.removeChild(videoElement);
            URL.revokeObjectURL(videoElement.src);
      
            this.addSystemMessage(
              `Video processing complete! ${processedFrames} frames extracted (interval: ${captureInterval.toFixed(2)}s)`
            );
      
            // If you want a single "main" frame for analysis:
            // e.g. pick the final or middle one:
            if (this.uploadedFrameURLs.length > 0) {
              this.uploadedImageURL = this.uploadedFrameURLs[
                Math.floor(this.uploadedFrameURLs.length / 2)
              ];
      
              this.addSystemMessage(
                'I set one representative frame to "uploadedImageURL". Ask "Analyze my form" to reference that frame.'
              );
            }
          });
      
          videoElement.addEventListener('error', (err) => {
            console.error('Video element error:', err);
            this.addSystemMessage(`Could not load video: ${file.name}`);
          });
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
            // **Check if the user is asking for an analysis**
            const analysisKeywords = ["form", "squat depth", "deadlift form", "bench press form", "lift"];
            const isAnalysisRequest = analysisKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
            const responseMessage = await this.sendToOpenAIAPI(
                message,
                isAnalysisRequest ? this.uploadedImageURL : null // **Only include image if it's an analysis request**
            );
    
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
   async sendToOpenAIAPI(userMessage, imageURL = null) {
    try {
        const apiKeyRef = this.database.ref('APIKEY');
        const snapshot = await apiKeyRef.once('value');
        const apiKey = snapshot.val();

        if (!apiKey) {
            console.error('API key not found in Firebase');
            return null;
        }

        // Construct the messages array
        const messages = [
            {
                role: "system",
                content: "You are a powerlifting coach chatbot and you sound like an enthusiastic human. You should help the user with their powerlifting questions and ignore all unrelated questions. Even when image views are obscure provide feedback"
            }
        ];

        // **Include the image URL if provided**
        if (imageURL) {
            messages.push({
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageURL
                        }
                    }
                ]
            });
        }

        // Add the user's message
        messages.push({
            role: "user",
            content: userMessage
        });

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            method: "POST",
            body: JSON.stringify({
                model: "gpt-4o-mini", // Ensure the correct model name
                messages: messages,
                temperature: 0.7,
                max_tokens: 3000
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