import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configure API key
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# Create the model with generation configuration
generation_config = {
  "temperature": 1,
  "top_p": 0.95,
  "top_k": 40,
  "max_output_tokens": 8192,
  "response_mime_type": "text/plain",
}

model = genai.GenerativeModel(
  model_name="gemini-1.5-flash",
  generation_config=generation_config,
  system_instruction="This is a powerlifting coach chatbot and you sound like an enthusiastic human. You should help the user with their powerlifting questions, and ignore all unrelated questions."
)

# Start a chat session
chat_session = model.start_chat(
  history=[]
)

# Send a message
response = chat_session.send_message("My squat is higher than my deadlift. Give me youtube links to help my deadlift")

print(response.text)