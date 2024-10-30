import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: "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",
});

document.getElementById('chatForm').addEventListener('submit', async function(e) {
  e.preventDefault(); // Prevent form submission

  const userMessage = document.getElementById('userMessage').value;
  if (userMessage.trim() === '') return; // Ignore empty messages

  // Display the user's message
  const chatContainer = document.getElementById('chatContainer');
  const userMessageElement = document.createElement('p');
  userMessageElement.className = 'text-right text-blue-600 font-semibold my-2';
  userMessageElement.textContent = `You: ${userMessage}`;
  chatContainer.appendChild(userMessageElement);
  
  // Scroll to the bottom of the chat container
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Clear the input field
  document.getElementById('userMessage').value = '';

  // Send the user's message to Claude
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      temperature: 0,
      system: "This is a powerlifting coach chatbot and you sound like an enthusiastic human. Help the user with their powerlifting questions; all other unrelated questions can be ignored. When the user gives a question, provide tips to improve with specific steps and give links to helpful up-to-date articles.",
      messages: [
        {
          role: "user",
          content: userMessage // Send the user's message here
        }
      ]
    });

    // Display the bot's response
    const botMessageElement = document.createElement('p');
    botMessageElement.className = 'text-left text-gray-600 my-2';
    botMessageElement.textContent = `Lift Ascend Bot: ${response.choices[0].message.content}`; // Adjust based on response format
    chatContainer.appendChild(botMessageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } catch (error) {
    console.error("Error communicating with Claude:", error);
    const errorMessageElement = document.createElement('p');
    errorMessageElement.className = 'text-left text-red-600 my-2';
    errorMessageElement.textContent = "Sorry, there was an error connecting to the bot. Please try again.";
    chatContainer.appendChild(errorMessageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});
