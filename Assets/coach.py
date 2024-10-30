import os
import json
from flask import Flask, request, jsonify
import anthropic

app = Flask(__name__)

client = anthropic.Anthropic(api_key="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")

@app.route('/send_message', methods=['POST'])
def send_message():
    data = request.get_json()
    user_message = data.get('message')

    # Save user message to a JSON file
    with open('chat_history.json', 'a') as f:
        json.dump({'user': user_message}, f)
        f.write('\n')  # Write a newline for better formatting

    # Prepare the message for the chatbot
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1000,
        temperature=0,
        system="This is a powerlifting coach chatbot and you sound like an enthusiastic human. You should help the user with their powerlifting questions. All other unrelated questions can be ignored. Do not ever answer an unrelated question to powerlifting and fitness in general. When the user gives a question, give tips on how to improve with specific steps and also provide links to helpful up-to-date articles.",
        messages=[{"role": "user", "content": user_message}]
    )

    # Save the bot's response to the JSON file
    bot_response = response.content
    with open('chat_history.json', 'a') as f:
        json.dump({'bot': bot_response}, f)
        f.write('\n')  # Write a newline for better formatting

    # Return the bot's response
    return jsonify({'response': bot_response})

if __name__ == '__main__':
    app.run(debug=True)
