import OpenAI from "./node_modules/openai"
require('dotenv').config();

const openai = new OpenAI({apiKey:process.env['OPENAI_API_KEY']});

const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
            role: "user",
            content: "Write a haiku about recursion in programming.",
        },
    ],
});

console.log(completion.choices[0].message);


// Main chat widget functionality
const chatButton = document.getElementById("chatButton");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const sendMessage = document.getElementById("sendMessage");


// Chat Widget Class
class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const chatButton = document.getElementById("chatButton");
        const chatForm = document.getElementById("chatForm");
        const chatInput = document.getElementById("chatInput");
        const sendMessage = document.getElementById("sendMessage");

        chatButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.toggleChat();
        });

        sendMessage.addEventListener("click", () => this.sendMessage());
        
        chatInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                this.sendMessage();
            }
        });

        document.addEventListener("click", (event) => {
            if (!chatForm.contains(event.target) && event.target !== chatButton) {
                this.closeChat();
            }
        });

        chatInput.addEventListener("input", () => {
            sendMessage.disabled = chatInput.value.trim() === "";
        });
    }

    toggleChat() {
        const chatForm = document.getElementById("chatForm");
        const chatButton = document.getElementById("chatButton");
        const chatInput = document.getElementById("chatInput");

        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            chatForm.classList.add("active");
            chatButton.classList.add("active");
            chatInput.focus();
            this.addSystemMessage("In testing Mode");
        } else {
            chatForm.classList.remove("active");
            chatButton.classList.remove("active");
        }
    }

    closeChat() {
        const chatForm = document.getElementById("chatForm");
        this.isOpen = false;
        chatForm.classList.remove("active");
    }

    sendMessage() {
        const chatInput = document.getElementById("chatInput");
        const message = chatInput.value.trim();
        if (message !== "") {
            this.addUserMessage(message);
            chatInput.value = "";
            document.getElementById("sendMessage").disabled = true;
            
            // Show typing indicator
            this.addSystemMessage("Typing...");

            setTimeout(() => {
                this.generateResponse(message);
            }, 1000);
        }
    }

    addUserMessage(text) {
        const chatMessages = document.getElementById("chatMessages");
        const messageElement = document.createElement("div");
        messageElement.className = "message user";
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    addSystemMessage(text) {
        const chatMessages = document.getElementById("chatMessages");
        const messageElement = document.createElement("div");
        messageElement.className = "message system";
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    generateResponse(userMessage) {
        // Remove the typing indicator before generating the response
        const chatMessages = document.getElementById("chatMessages");
        const typingIndicator = chatMessages.querySelector(".message.system:last-child");
        if (typingIndicator && typingIndicator.textContent === "Typing...") {
            typingIndicator.remove();
        }

        const responses = [
            "Thanks for your message! Our team will get back to you soon.",
            "I understand. Let me help you with that.",
            "Thank you for reaching out. How else can I assist you?",
            "I've noted your message. Is there anything else you'd like to know?"
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        this.addSystemMessage(randomResponse);
    }

    scrollToBottom() {
        const chatMessages = document.getElementById("chatMessages");
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Initialize the chat widget
const chatWidget = new ChatWidget();

