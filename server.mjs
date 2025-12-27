import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3000;

// --- Resolve __dirname for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Helper: load & save agents.json ---

function loadAgents() {
  try {
    const data = fs.readFileSync(path.join(__dirname, "agents.json"), "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to load agents.json:", err);
    return {};
  }
}

function saveAgents(agents) {
  try {
    fs.writeFileSync(
      path.join(__dirname, "agents.json"),
      JSON.stringify(agents, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("Failed to save agents.json:", err);
  }
}

// --- Express middleware ---

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Build prompt per agent ---

function buildSystemPrompt(agentConfig) {
  const {
    agencyName,
    area,
    specialism,
    tone
  } = agentConfig;

  return `
You are an AI assistant representing ${agencyName},
a real estate agency specialising in ${specialism} in ${area}.

Your goals:
- Answer property-related questions clearly and honestly.
- Help qualify leads by asking about their budget, preferred areas, bedrooms, and timing.
- Encourage users to leave their name, email, and phone so an agent can contact them.
- Keep answers concise (3–6 sentences) unless more detail is requested.
- Never invent specific property details (exact prices, square metres, legal or mortgage advice).
  If you are not sure, say you don't know and suggest speaking to a human agent.

Important:
- Write in a ${tone} tone.
- Refer to the agency as "we" and "our team".
- Do not mention that you are an AI model or talk about prompts.
`;
}

// --- API: Save an agent's own OpenAI API key (used after upgrade) ---

app.post("/api/save-key", (req, res) => {
  try {
    const { agentId, apiKey } = req.body;
    console.log("---- CHAT REQUEST ----");
console.log("Agent ID:", agentId);
console.log("Agent has key:", Boolean(agent.apiKey));
console.log(
  "Key source:",
  agent.apiKey ? "agents.json (agent.apiKey)" : ".env (process.env.OPENAI_API_KEY)"
);

const openaiKey = agent.apiKey || process.env.OPENAI_API_KEY;

console.log("Key prefix:", openaiKey ? openaiKey.slice(0, 7) : "NO KEY");


    if (!agentId || !apiKey) {
      return res.status(400).json({ error: "Missing agentId or apiKey" });
    }

    const agents = loadAgents();

    if (!agents[agentId]) {
      return res.status(404).json({ error: "Agent not found" });
    }

    agents[agentId].apiKey = apiKey;
    saveAgents(agents);

    return res.json({ message: "API key saved successfully." });
  } catch (err) {
  console.error("---- OPENAI ERROR ----");
  console.error("Message:", err?.message);
  console.error("Code:", err?.code);
  console.error("Type:", err?.type);
  console.error("Status:", err?.status);
  console.error("Full error object:", err);

  res.status(500).json({
    error: "AI response failed"
  });
}
});

// --- API: Chat endpoint ---

app.post("/api/chat", async (req, res) => {
  try {
    let { messages, agentId } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    // Default agent for now
    if (!agentId) {
      agentId = "example-estates";
    }

    const agents = loadAgents();
    const agent = agents[agentId];

    if (!agent) {
      return res.status(404).json({ error: "Unknown agent" });
    }

    // MODEL 3 LOGIC:
    //  - If agent.apiKey is set -> use THEIR OpenAI key
    //  - Else -> use YOUR key from .env (free trial / demo)
    const openaiKey = agent.apiKey || process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return res.status(500).json({
        error: "missing_api_key",
        reply:
          "The AI service is not configured yet. Please contact the site owner to add an OpenAI API key."
      });
    }

    const client = new OpenAI({ apiKey: openaiKey });

    const systemPrompt = buildSystemPrompt(agent);

    const inputMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const response = await client.responses.create({
      // You can change this to whatever your account supports, e.g. "gpt-4o-mini"
      model: "gpt-4o-mini",
      input: inputMessages
    });

    let replyText = "Sorry, I could not generate a response.";

    if (
      response &&
      Array.isArray(response.output) &&
      response.output[0] &&
      response.output[0].content &&
      response.output[0].content[0] &&
      response.output[0].content[0].text &&
      response.output[0].content[0].text.value
    ) {
      replyText = response.output[0].content[0].text.value;
    }

    return res.json({ reply: replyText });
  } catch (err) {
    console.error("Chat error:", err);

    // Detect quota issues & send a clearer message
    const code =
      err?.error?.code || err?.code || err?.error?.type || "unknown_error";

    if (code === "insufficient_quota") {
      return res.status(500).json({
        error: "insufficient_quota",
        reply:
          "Our AI service has reached its usage limit. Please contact the site owner to top up their OpenAI credits."
      });
    }

    return res.status(500).json({
      error: "Chat error",
      reply:
        "Sorry, I had a problem answering that. Please try again in a moment."
    });
  }
});

// --- Start server ---

app.listen(port, () => {
  console.log(`Estate agent chatbot running at http://localhost:${port}`);
});
