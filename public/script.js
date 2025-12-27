// --- Config ---
// Single agent for now; later you can pass this via query param or subdomain.
const AGENT_ID = "example-estates";

const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

const leadForm = document.getElementById("lead-form");
const leadStatus = document.getElementById("lead-status");

const apiKeyInput = document.getElementById("agent-api-key");
const saveKeyBtn = document.getElementById("save-key-btn");
const saveStatus = document.getElementById("save-status");
const toggleBtn = document.getElementById("toggle-settings");
const settingsBody = document.getElementById("settings-body");
if (toggleBtn && settingsBody) {
  toggleBtn.addEventListener("click", () => {
    const isHidden = settingsBody.classList.contains("hidden");
    settingsBody.classList.toggle("hidden", !isHidden);
    toggleBtn.textContent = isHidden ? "Hide" : "Show";
  });
}


// Conversation state
let messages = [];

// --- Chat UI helpers ---

function addMessageBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.classList.add(
    "bubble",
    role === "user" ? "bubble-user" : "bubble-assistant"
  );
  bubble.textContent = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage(event) {
  event.preventDefault();

  const userText = chatInput.value.trim();
  if (!userText) return;

  addMessageBubble("user", userText);
  messages.push({ role: "user", content: userText });

  chatInput.value = "";
  chatInput.focus();

  const typingBubble = document.createElement("div");
  typingBubble.classList.add("bubble", "bubble-assistant", "typing");
  typingBubble.textContent = "Assistant is typing...";
  chatWindow.appendChild(typingBubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  sendBtn.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, agentId: AGENT_ID })
    });

    const data = await res.json();

    if (typingBubble.parentNode) {
      chatWindow.removeChild(typingBubble);
    }

    const replyText =
      data.reply || data.error || "Sorry, something went wrong.";
    addMessageBubble("assistant", replyText);
    messages.push({ role: "assistant", content: replyText });
  } catch (err) {
    console.error("Chat error:", err);
    if (typingBubble.parentNode) {
      chatWindow.removeChild(typingBubble);
    }
    addMessageBubble(
      "assistant",
      "Sorry, I had a problem answering that. Please try again."
    );
  } finally {
    sendBtn.disabled = false;
  }
}

chatForm.addEventListener("submit", sendMessage);

// --- Lead form (still just logs; you can later POST to backend/CRM) ---

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("lead-name").value.trim();
  const email = document.getElementById("lead-email").value.trim();
  const phone = document.getElementById("lead-phone").value.trim();
  const notes = document.getElementById("lead-notes").value.trim();

  console.log("Lead captured:", { name, email, phone, notes });

  leadStatus.textContent = "Thanks! Our team will contact you shortly.";
  leadStatus.classList.add("success");

  leadForm.reset();
});

// --- Admin: Save OpenAI API key for this agent ---

saveKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  saveStatus.textContent = "";
  saveStatus.classList.remove("success", "error");

  if (!key.startsWith("sk-")) {
    saveStatus.textContent = "Please paste a valid OpenAI API key.";
    saveStatus.classList.add("error");
    return;
  }

  try {
    const res = await fetch("/api/save-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: AGENT_ID, apiKey: key })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to save key");
    }

    saveStatus.textContent = "Key saved. Future chats will use your OpenAI billing.";
    saveStatus.classList.add("success");
    apiKeyInput.value = "";
  } catch (err) {
    console.error("Save-key error:", err);
    saveStatus.textContent = err.message || "Failed to save key.";
    saveStatus.classList.add("error");
  }
});

