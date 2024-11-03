import os
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
)

# Start a chat session
chat_session = model.start_chat(
  history=[]
)

# Send a message
response = chat_session.send_message("Hello")

# Print the response
print(response.text)
