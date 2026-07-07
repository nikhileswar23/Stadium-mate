const GEMINI_API_KEY = "PASTE_YOUR_KEY_HERE";

const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');

let chatHistory = [];

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    // Add user message to UI
    addMessage(text, 'user-message');
    userInput.value = '';

    // Add user message to history
    chatHistory.push({
        role: "user",
        parts: [{ text: text }]
    });

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        const responseText = await fetchGeminiResponse(chatHistory);
        removeTypingIndicator(typingId);

        // Add bot message to UI
        addMessage(responseText, 'bot-message');

        // Add bot message to history
        chatHistory.push({
            role: "model",
            parts: [{ text: responseText }]
        });
    } catch (error) {
        console.error(error);
        removeTypingIndicator(typingId);
        addMessage("Sorry, I encountered an error. Please try again later.", 'bot-message error-message');
        // Remove the user message from history so they can retry without corrupting history
        chatHistory.pop();
    }
});

function addMessage(text, className) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${className}`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble';

    // Using textContent to prevent XSS
    bubbleDiv.textContent = text;

    msgDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(msgDiv);

    scrollToBottom();
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot-message';
    msgDiv.id = id;

    msgDiv.innerHTML = `
        <div class="typing-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;

    chatContainer.appendChild(msgDiv);
    scrollToBottom();
    return id;
}

function removeTypingIndicator(id) {
    const element = document.getElementById(id);
    if (element) {
        element.remove();
    }
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function fetchGeminiResponse(history) {
    const systemInstruction = {
        role: "system",
        parts: [{
            text: `You are StadiumMate, a helpful, multilingual AI chat assistant for fans at FIFA World Cup 2026 stadiums. You must always reply in the same language the user wrote in. Be concise, friendly, and helpful.`
        }]
    };

    const requestBody = {
        systemInstruction: systemInstruction,
        contents: history,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
        }
    };

    const apiKey = GEMINI_API_KEY.trim();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Unexpected API response structure");
    }
}
