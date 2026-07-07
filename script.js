const GEMINI_API_KEY = "PASTE_YOUR_API_KEY";



const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');

let chatHistory = [];
let stadiumData = null;

// Load stadium data when the script starts
async function loadStadiumData() {
    try {
        const response = await fetch('stadium_data.json');
        if (response.ok) {
            stadiumData = await response.json();
            console.log("Stadium data loaded successfully.");
        } else {
            console.error("Failed to load stadium_data.json:", response.status);
        }
    } catch (error) {
        console.error("Error fetching stadium_data.json:", error);
    }
}
loadStadiumData();

async function handleSendMessage(text) {
    if (!text) return;

    // Add user message to UI
    addMessage(text, 'user-message');

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
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    userInput.value = '';
    await handleSendMessage(text);
});

// Event listeners for suggestion chips
document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        handleSendMessage(chip.textContent.trim());
    });
});

// Event listener for emergency button
const emergencyBtn = document.getElementById('emergencyBtn');
if (emergencyBtn) {
    emergencyBtn.addEventListener('click', () => {
        handleSendMessage('Where is the first-aid station?');
    });
}

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
            text: `You are StadiumMate, a multilingual assistant for the 2026 World Cup. You must base all your answers ONLY on the provided stadium_data.json. If the user asks for something not in the data, politely say you don't have that info. Always reply in the exact same language the user wrote in.

stadium_data.json:
${JSON.stringify(stadiumData, null, 2)}`
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
