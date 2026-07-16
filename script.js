const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');

let chatHistory = [];
let uiHistory = [];
let stadiumData = null;
let lastInputMode = 'text'; // Tracks if the last input was 'text' or 'voice'
let userLocationId = 'plaza'; // Default user location

const locationCoords = {
    'plaza': { x: 400, y: 550 },
    'gate-a': { x: 400, y: 120 },
    'gate-b': { x: 620, y: 170 },
    'gate-c': { x: 680, y: 300 },
    'gate-d': { x: 400, y: 480 },
    'gate-e': { x: 120, y: 300 },
    'gate-g': { x: 180, y: 170 },
    'food-world': { x: 300, y: 160 },
    'food-latin': { x: 500, y: 160 },
    'food-global': { x: 600, y: 300 },
    'food-pizza': { x: 500, y: 440 },
    'food-cafe': { x: 200, y: 350 },
    'first-aid-north': { x: 400, y: 200 },
    'first-aid-south': { x: 400, y: 400 },
    'first-aid-upper': { x: 240, y: 200 },
    'water-1': { x: 420, y: 150 },
    'water-2': { x: 580, y: 250 },
    'water-3': { x: 450, y: 400 },
    'prayer-room': { x: 560, y: 220 },
    'guest-services': { x: 340, y: 460 },
    'guest-services-a': { x: 450, y: 140 },
    'rail-station': { x: 750, y: 300 },
    'bus-plaza': { x: 50, y: 300 },
    'rideshare-zone': { x: 400, y: 50 }
};

const facilityCategories = {
    'first-aid': ['first-aid-north', 'first-aid-south', 'first-aid-upper'],
    'food': ['food-world', 'food-latin', 'food-global', 'food-pizza', 'food-cafe'],
    'water': ['water-1', 'water-2', 'water-3']
};

function getRingDistance(fromId, toId) {
    const fromC = locationCoords[fromId];
    const toC = locationCoords[toId];
    if (!fromC || !toC) return Infinity;

    const ringNodes = [];
    const cx = 400, cy = 300, rx = 220, ry = 140;
    for (let i = 0; i < 16; i++) {
        const angle = i * (2 * Math.PI / 16);
        ringNodes.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
    }

    function nearest(x, y) {
        let min = Infinity, idx = 0;
        for (let i = 0; i < 16; i++) {
            const d = Math.hypot(ringNodes[i].x - x, ringNodes[i].y - y);
            if (d < min) { min = d; idx = i; }
        }
        return idx;
    }

    const startIdx = nearest(fromC.x, fromC.y);
    const endIdx = nearest(toC.x, toC.y);

    const distCW = (endIdx - startIdx + 16) % 16;
    const distCCW = (startIdx - endIdx + 16) % 16;

    const spur1 = Math.hypot(fromC.x - ringNodes[startIdx].x, fromC.y - ringNodes[startIdx].y);
    const spur2 = Math.hypot(toC.x - ringNodes[endIdx].x, toC.y - ringNodes[endIdx].y);
    const arcDist = Math.min(distCW, distCCW) * 45; // Approx arc length per hop

    return spur1 + arcDist + spur2;
}

function getNearestCategory(cat, fromId) {
    if (!facilityCategories[cat]) return null;
    let minD = Infinity;
    let best = null;
    for (const id of facilityCategories[cat]) {
        const d = getRingDistance(fromId, id);
        if (d < minD) {
            minD = d;
            best = id;
        }
    }
    return best;
}

function saveState() {
    sessionStorage.setItem('stadiumMateHistory', JSON.stringify(chatHistory));
    sessionStorage.setItem('stadiumMateUI', JSON.stringify(uiHistory));
}

// Restore state on load

window.addEventListener('DOMContentLoaded', () => {
    const cameFromMap = sessionStorage.getItem('returningFromMap') === 'true';
    sessionStorage.removeItem('returningFromMap');

    if (cameFromMap) {
        // Returning from the map: restore the conversation
        const savedHistory = sessionStorage.getItem('stadiumMateHistory');
        const savedUI = sessionStorage.getItem('stadiumMateUI');
        if (savedHistory && savedUI) {
            chatHistory = JSON.parse(savedHistory);
            JSON.parse(savedUI).forEach(msg => {
                addMessage(msg.text, msg.className, msg.lang, msg.locationId, false);
            });
            uiHistory = JSON.parse(savedUI);
        }
    } else {
        // Fresh visit or refresh: wipe everything, start clean
        sessionStorage.removeItem('stadiumMateHistory');
        sessionStorage.removeItem('stadiumMateUI');
        chatHistory = [];
        uiHistory = [];
    }
    // Initialize location picker UI
    const savedLocation = sessionStorage.getItem('userLocation');
    if (savedLocation) {
        userLocationId = savedLocation;
    }

    const locationPillBtn = document.getElementById('locationPillBtn');
    const locationSheetBackdrop = document.getElementById('locationSheetBackdrop');
    const locationSheet = document.getElementById('locationSheet');
    const locBtns = document.querySelectorAll('.loc-btn');
    const toast = document.getElementById('toast');

    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        // Force reflow for transition
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2500);
    }

    function updateLocationUI() {
        const locationNameMap = {
            'plaza': 'Main Entrance Plaza',
            'gate-a': 'Gate A',
            'gate-b': 'Gate B',
            'gate-c': 'Gate C',
            'gate-d': 'Gate D',
            'gate-e': 'Gate E',
            'gate-g': 'Gate G'
        };

        const locName = locationNameMap[userLocationId] || 'Main Entrance Plaza';
        if (locationPillBtn) {
            locationPillBtn.textContent = `📍 ${locName}`;
        }

        locBtns.forEach(btn => {
            if (btn.dataset.loc === userLocationId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function openLocationSheet() {
        locationSheetBackdrop.classList.remove('hidden');
        locationSheet.classList.remove('hidden');
        // Force reflow
        void locationSheet.offsetWidth;
        locationSheet.classList.add('open');
    }

    function closeLocationSheet() {
        locationSheet.classList.remove('open');
        setTimeout(() => {
            locationSheet.classList.add('hidden');
            locationSheetBackdrop.classList.add('hidden');
        }, 300);
    }

    if (locationPillBtn) {
        locationPillBtn.addEventListener('click', openLocationSheet);
    }

    if (locationSheetBackdrop) {
        locationSheetBackdrop.addEventListener('click', closeLocationSheet);
    }

    locBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newLoc = e.currentTarget.dataset.loc;
            userLocationId = newLoc;
            sessionStorage.setItem('userLocation', userLocationId);
            updateLocationUI();
            closeLocationSheet();
            showToast(`Location set: ${e.currentTarget.textContent}`);
        });
    });

    // Initialize UI on load
    updateLocationUI();
});

let voices = [];
if ('speechSynthesis' in window) {
    voices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
    };
}

function pickBestVoice(langCode) {
    if (!langCode || voices.length === 0) return null;

    const langLower = langCode.toLowerCase();
    const prefix = langLower.split('-')[0];

    // 1. "Google" + matching language
    let best = voices.find(v => v.name.includes("Google") && v.lang.toLowerCase() === langLower);
    if (best) return best;

    // 2. "Natural" + matching language
    best = voices.find(v => v.name.includes("Natural") && v.lang.toLowerCase() === langLower);
    if (best) return best;

    // 3. matching language exact
    best = voices.find(v => v.lang.toLowerCase() === langLower);
    if (best) return best;

    // 4. matching prefix
    best = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
    if (best) return best;

    // 5. default
    best = voices.find(v => v.default);
    return best || voices[0];
}

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

    lastInputMode = 'text';

    if ('speechSynthesis' in window) {
        if (typeof cancelSpeechQueue === 'function') {
            cancelSpeechQueue();
        } else {
            window.speechSynthesis.cancel();
        }
        if (typeof resetSpeakerBtn === 'function' && typeof currentSpeakerBtn !== 'undefined') {
            resetSpeakerBtn(currentSpeakerBtn);
            currentSpeakerBtn = null;
        }
    }

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
        const responseData = await fetchGeminiResponse(chatHistory);
        const responseText = responseData.reply;
        const responseLang = responseData.lang || 'en-US';
        const locationId = responseData.location_id || null;

        removeTypingIndicator(typingId);

        // Add bot message to UI
        const speakerBtn = addMessage(responseText, 'bot-message', responseLang, locationId);

        // Add bot message to history
        chatHistory.push({
            role: "model",
            parts: [{ text: responseText }]
        });
        saveState();

        // Speak the response text only if the user used voice input
        if (lastInputMode === 'voice') {
            speakText(responseText, responseLang, speakerBtn);
        }
    } catch (error) {
        console.error(error);
        removeTypingIndicator(typingId);

        // Show specific friendly messages for rate limiting and server busy
        if (error && error.message && error.message.includes('503')) {
            addMessage("The AI service is very busy right now — please try again in a few minutes", 'bot-message error-message');
        } else if (error && error.message && error.message.includes('429')) {
            addMessage("I'm getting too many requests right now (rate limit). Please wait about a minute and try again.", 'bot-message error-message');
        } else {
            addMessage("Sorry, I encountered an error. Please try again later.", 'bot-message error-message');
        }
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
// IMPORTANT: exclude the location pill — it opens the bottom sheet, it must NOT send a chat message
document.querySelectorAll('.chip:not(.location-pill)').forEach(chip => {
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

function addMessage(text, className, lang = 'en-US', locationId = null, save = true) {
    if (save && !className.includes('error-message')) {
        uiHistory.push({ text, className, lang, locationId });
        saveState();
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${className}`;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble';

    // Using textContent to prevent XSS
    bubbleDiv.textContent = text;

    contentWrapper.appendChild(bubbleDiv);

    let speakerBtn = null;

    // Add speaker button to bot messages
    if (className.includes('bot-message') && !className.includes('error-message')) {
        speakerBtn = document.createElement('button');
        speakerBtn.className = 'speaker-btn';
        speakerBtn.setAttribute('aria-label', 'Read aloud');
        speakerBtn.title = 'Read aloud';
        speakerBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
        `;
        speakerBtn.addEventListener('click', () => {
            if (speakerBtn.classList.contains('speaking-active')) {
                // Stop speech if already playing this message
                if (typeof cancelSpeechQueue === 'function') cancelSpeechQueue();
                else window.speechSynthesis.cancel();
                resetSpeakerBtn(speakerBtn);
                currentSpeakerBtn = null;
            } else {
                speakText(text, lang, speakerBtn);
            }
        });
        contentWrapper.appendChild(speakerBtn);
    }

    msgDiv.appendChild(contentWrapper);

    if (className.includes('bot-message') && !className.includes('error-message') && locationId) {
        const mapBtn = document.createElement('button');
        mapBtn.className = 'take-me-there-btn';
        mapBtn.innerHTML = '🗺️ Take me there';
        mapBtn.addEventListener('click', () => {
            const externalDestinations = {
                'rail-station': 'Meadowlands Rail Station, East Rutherford NJ',
                'bus-plaza': 'MetLife Stadium Bus Plaza, East Rutherford NJ',
                'rideshare-zone': 'MetLife Stadium Parking Lot K, East Rutherford NJ'
            };
            if (externalDestinations[locationId]) {
                const destination = encodeURIComponent(externalDestinations[locationId]);
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
            } else {
                saveState(); // Ensure state is saved before navigating
                sessionStorage.setItem('returningFromMap', 'true');
                window.location.href = `map.html?dest=${locationId}&from=${userLocationId}`;
            }
        });
        msgDiv.appendChild(mapBtn);
    }

    chatContainer.appendChild(msgDiv);

    scrollToBottom();

    return speakerBtn;
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

function buildSystemPrompt(isVoice) {
    const locationNameMap = {
        'plaza': 'Main Entrance Plaza',
        'gate-a': 'Gate A',
        'gate-b': 'Gate B',
        'gate-c': 'Gate C',
        'gate-d': 'Gate D',
        'gate-e': 'Gate E',
        'gate-g': 'Gate G'
    };
    const locationContextName = locationNameMap[userLocationId] || 'Main Entrance Plaza';

    const nearestFirstAid = getNearestCategory('first-aid', userLocationId);
    const nearestFood = getNearestCategory('food', userLocationId);
    const nearestWater = getNearestCategory('water', userLocationId);

    const nameMap = {
        'first-aid-north': 'First-Aid Station North (Concourse 1)',
        'first-aid-south': 'First-Aid Station South (Concourse 2, behind section 129)',
        'first-aid-upper': 'First-Aid Upper Deck',
        'food-world': 'Food World',
        'food-latin': 'Food Latin',
        'food-global': 'Food Global',
        'food-pizza': 'Liberty Slice Pizza',
        'food-cafe': 'Meadowlands Cafe',
        'water-1': 'Water Refill (Sec 110)',
        'water-2': 'Water Refill (Sec 220)',
        'water-3': 'Water Refill (Sec 330)'
    };

    return {
        role: "system",
        parts: [{
            text: `You are StadiumMate, a multilingual assistant for the 2026 World Cup. You must base all your answers ONLY on the provided stadium_data.json. If the user asks for something not in the data, politely say you don't have that info. Always reply in the exact same language the user wrote in. Keep your responses concise (max 3 sentences — a fan reads on a phone). Avoid heavy markdown formatting, bullet points, or complex tables. Write your answers as if they are meant to be read aloud by a voice assistant to a fan walking through a crowded stadium.
You must ALWAYS include every field in your JSON response: ${isVoice ? "transcript, " : ""}reply, lang, location_id (a known id, a category id, or null).

The fan is currently near: ${locationContextName}. (Use this to answer proximity questions naturally).

When multiple locations of a facility exist, mention ONLY the single nearest one — never list all of them.
For facilities with multiple locations, return the CATEGORY id ('first-aid', 'water', 'food').
- The nearest first aid is ${nameMap[nearestFirstAid]}.
- The nearest food is ${nameMap[nearestFood]}.
- The nearest water is ${nameMap[nearestWater]}.
Include this specific nearest location's name naturally in your reply!

location_id must be EXACTLY one of the listed id strings, e.g. 'gate-c' — never a number, never a section number, never any other text.

Intent Mapping Rules:
- Questions about drinking water, drinking spots, water fountains, refill stations, filling a bottle, or being thirsty ALL map to the 'water' category.
- Questions about medic, doctor, injury, hurt, medical help, feeling sick ALL map to the 'first-aid' category.
- Questions about eat, hungry, snacks, restaurants, drinks with meals ALL map to the 'food' category.
- Questions like "I want to pray", "namaz", "salah", "mosque", "quiet place to pray", "multi-faith room" ALL map to location_id: "prayer-room".
- Questions like "train", "rail", "metro", "how do I get to New York", "fastest way to the city", "station" ALL map to location_id: "rail-station".
- Questions like "bus", "coach", "bus to New York" ALL map to location_id: "bus-plaza".
- Questions like "taxi", "Uber", "Lyft", "cab", "rideshare pickup" ALL map to location_id: "rideshare-zone".
- Questions like "lost my phone", "lost and found", "lost child", "I need help", "information desk" ALL map to location_id: "guest-services".

Specific unique places (gates, prayer-room, guest-services, rail-station, bus-plaza, rideshare-zone) keep their exact ids.

Examples:
User: "where is the nearest first aid" -> location_id: "first-aid", reply: "The nearest first aid is ${nameMap[nearestFirstAid]}."
User: "any drinking spots here?" -> location_id: "water", reply: "The nearest water is ${nameMap[nearestWater]}."
User: "where is gate C" -> location_id: "gate-c" (NOT "3", NOT "Gate C", NOT "section 116")
User: "I want to pray" -> location_id: "prayer-room"
User: "where can I catch a train?" -> location_id: "rail-station"
User: "fastest way to New York" -> location_id: "rail-station"
User: "what time do gates open" -> location_id: null

stadium_data.json:
${JSON.stringify(stadiumData)}`
        }]
    };
}

async function callGemini(requestBody) {
    const maxTries = 2; // 1 initial + 1 retry

    for (let attempt = 1; attempt <= maxTries; attempt++) {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestBody })
        });

        if (response.ok) {
            return response;
        }

        if (response.status === 503 && attempt < maxTries) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }

        const errBody = await response.text();
        console.error("API error body:", errBody);
        throw new Error(`API Error: ${response.status}`);
    }
}

async function fetchGeminiResponse(history) {
    const systemInstruction = buildSystemPrompt(false);

    const requestBody = {
        systemInstruction: systemInstruction,
        contents: history.slice(-10),
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
        }
    };

    const response = await callGemini(requestBody);

    const data = await response.json();

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        let responseText = data.candidates[0].content.parts[0].text;

        // Strip markdown code fences and leading/trailing text before JSON
        const match = responseText.match(/\{[\s\S]*\}/);
        const jsonText = match ? match[0] : responseText.replace(/^```(json)?\n/i, '').replace(/\n```$/i, '').trim();

        try {
            const parsedResponse = JSON.parse(jsonText);
            let locationId = parsedResponse.location_id || null;
            
            if (locationId !== null) {
                if (typeof locationId !== 'string' || !(locationCoords.hasOwnProperty(locationId) || facilityCategories.hasOwnProperty(locationId))) {
                    locationId = null;
                }
            }

            if (locationId && facilityCategories[locationId]) {
                locationId = getNearestCategory(locationId, userLocationId);
            }

            return {
                reply: parsedResponse.reply || "I'm sorry, I couldn't generate a reply.",
                lang: parsedResponse.lang || "en-US",
                location_id: locationId
            };
        } catch (e) {
            console.error("JSON Parse Error:", e, "Raw Response:", responseText);
            return { reply: "Please try asking again.", lang: "en-US", location_id: null };
        }
    } else {
        console.log("Unexpected API response structure:", JSON.stringify(data, null, 2));
        return { reply: "Please try asking again.", lang: "en-US", location_id: null };
    }
}

// Gemini Voice Input Logic
const micBtn = document.getElementById('mic-btn');
let mediaRecorder = null;
let audioChunks = [];
let recordTimeout = null;

if (micBtn) {
    micBtn.addEventListener('click', async () => {
        if (micBtn.classList.contains('listening')) {
            // Stop recording
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            return;
        }

        // Start recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            let options = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                options = {}; // let browser choose default (e.g., audio/mp4 on Safari)
            }

            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                micBtn.classList.remove('listening');
                clearTimeout(recordTimeout);

                // Stop all tracks to release the microphone hardware
                stream.getTracks().forEach(track => track.stop());

                if (audioChunks.length === 0) return;

                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    // Extract base64 and mimeType
                    const base64Audio = reader.result.split(',')[1];
                    const mimeType = audioBlob.type.split(';')[0] || 'audio/webm';
                    await handleAudioMessage(base64Audio, mimeType);
                };
            };

            micBtn.classList.add('listening');
            mediaRecorder.start();

            // Auto stop after 10 seconds
            recordTimeout = setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 10000);

        } catch (error) {
            console.error('Microphone access error:', error);
            alert("Microphone access was denied or is not supported. Please allow microphone access to use voice input.");
            micBtn.classList.remove('listening');
        }
    });
}

async function handleAudioMessage(base64Audio, mimeType) {
    lastInputMode = 'voice';

    if ('speechSynthesis' in window) {
        if (typeof cancelSpeechQueue === 'function') {
            cancelSpeechQueue();
        } else {
            window.speechSynthesis.cancel();
        }
        if (typeof resetSpeakerBtn === 'function' && typeof currentSpeakerBtn !== 'undefined') {
            resetSpeakerBtn(currentSpeakerBtn);
            currentSpeakerBtn = null;
        }
    }

    const typingId = showTypingIndicator();

    try {
        const systemInstruction = buildSystemPrompt(true);

        const promptText = `Transcribe this audio exactly in its original language, then answer the question as StadiumMate. Respond ONLY in JSON with transcript and reply in the speaker's language, and lang as the BCP-47 language code.`;

        const newContents = [...chatHistory, {
            role: "user",
            parts: [
                { text: promptText },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Audio
                    }
                }
            ]
        }];

        const requestBody = {
            systemInstruction: systemInstruction,
            contents: newContents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        };

        const response = await callGemini(requestBody);

        const data = await response.json();

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let responseText = data.candidates[0].content.parts[0].text;

            // Strip markdown code fences and leading/trailing text before JSON
            const match = responseText.match(/\{[\s\S]*\}/);
            const jsonText = match ? match[0] : responseText.replace(/^```(json)?\n/i, '').replace(/\n```$/i, '').trim();

            try {
                const parsedResponse = JSON.parse(jsonText);
                let locationId = parsedResponse.location_id || null;
                
                if (locationId !== null) {
                    if (typeof locationId !== 'string' || !(locationCoords.hasOwnProperty(locationId) || facilityCategories.hasOwnProperty(locationId))) {
                        locationId = null;
                    }
                }

                if (locationId && facilityCategories[locationId]) {
                    locationId = getNearestCategory(locationId, userLocationId);
                }

                const transcript = parsedResponse.transcript || "Audio could not be transcribed.";
                const reply = parsedResponse.reply || "I'm sorry, I couldn't generate a reply.";
                const lang = parsedResponse.lang || "en-US";

                removeTypingIndicator(typingId);

                // Add transcript as user message and reply as bot message to UI
                addMessage(transcript, 'user-message');
                const speakerBtn = addMessage(reply, 'bot-message', lang, locationId);

                // Add to history
                chatHistory.push({
                    role: "user",
                    parts: [{ text: transcript }]
                });
                chatHistory.push({
                    role: "model",
                    parts: [{ text: reply }]
                });
                saveState();

                // Speak reply aloud only if voice mode
                if (lastInputMode === 'voice') {
                    speakText(reply, lang, speakerBtn);
                }

            } catch (parseError) {
                console.error("JSON Parse Error:", parseError, "Raw Response:", responseText);
                removeTypingIndicator(typingId);
                addMessage("Please try asking again.", 'bot-message error-message');
            }
        } else {
            console.log("Unexpected API response structure:", JSON.stringify(data, null, 2));
            removeTypingIndicator(typingId);
            addMessage("Please try asking again.", 'bot-message error-message');
        }

    } catch (error) {
        console.error(error);
        removeTypingIndicator(typingId);

        if (error && error.message && error.message.includes('503')) {
            addMessage("The AI service is very busy right now — please try again in a few minutes", 'bot-message error-message');
        } else if (error && error.message && error.message.includes('429')) {
            addMessage("I'm getting too many requests right now (rate limit). Please wait about a minute and try again.", 'bot-message error-message');
        } else {
            addMessage("Sorry, I encountered an error processing your audio. Please try again.", 'bot-message error-message');
        }
    }
}

// Text-to-Speech Logic
let currentSpeakerBtn = null;
let speechQueue = [];
let isSpeakingQueue = false;

function cancelSpeechQueue() {
    window.speechSynthesis.cancel();
    speechQueue = [];
    isSpeakingQueue = false;
}

function resetSpeakerBtn(btn) {
    if (btn) {
        btn.classList.remove('speaking-active');
        // Play icon
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
        `;
        const label = btn.nextElementSibling;
        if (label && label.classList.contains('speaking-label')) {
            label.remove();
        }
    }
}

function setSpeakerBtnActive(btn) {
    if (btn) {
        btn.classList.add('speaking-active');
        // Stop icon (square)
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="6" width="12" height="12"></rect>
            </svg>
        `;
        // Add speaking label if not present
        if (!btn.nextElementSibling || !btn.nextElementSibling.classList.contains('speaking-label')) {
            const label = document.createElement('span');
            label.className = 'speaking-label';
            label.textContent = 'Speaking...';
            btn.parentNode.insertBefore(label, btn.nextSibling);
        }
    }
}

function speakText(text, langCode, btnElement = null) {
    if (!('speechSynthesis' in window)) {
        console.warn("Text-to-Speech is not supported in this browser.");
        return;
    }

    const cleanText = text.replace(/[*_#`~]/g, '').trim();
    if (!cleanText) return;

    // Stop any ongoing speech before starting a new one
    cancelSpeechQueue();
    resetSpeakerBtn(currentSpeakerBtn);

    currentSpeakerBtn = btnElement;
    setSpeakerBtnActive(currentSpeakerBtn);

    // Split into sentences if longer than 200 chars
    if (cleanText.length > 200) {
        const sentences = cleanText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [cleanText];
        speechQueue = sentences.map(s => s.trim()).filter(s => s.length > 0);
    } else {
        speechQueue = [cleanText];
    }

    isSpeakingQueue = true;
    playNextInQueue(langCode);
}

function playNextInQueue(langCode) {
    if (speechQueue.length === 0) {
        isSpeakingQueue = false;
        resetSpeakerBtn(currentSpeakerBtn);
        currentSpeakerBtn = null;
        return;
    }

    const textChunk = speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(textChunk);

    const selectedVoice = pickBestVoice(langCode);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    utterance.lang = langCode || 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
        if (isSpeakingQueue) {
            playNextInQueue(langCode);
        }
    };

    utterance.onerror = (e) => {
        console.error("Speech synthesis error", e);
        if (e.error !== 'canceled') {
            if (isSpeakingQueue) {
                playNextInQueue(langCode);
            }
        } else {
            resetSpeakerBtn(currentSpeakerBtn);
            currentSpeakerBtn = null;
        }
    };

    window.speechSynthesis.speak(utterance);
}
// Handle back/forward cache: if the browser restores a frozen copy of
// this page (bfcache), force a real reload so our init logic runs.
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});