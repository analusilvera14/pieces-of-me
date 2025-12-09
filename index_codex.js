import OpenAI from "openai";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function askCodex() {
  rl.question("\n🧠 What do you want Codex to do? ", async (userPrompt) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a coding assistant that helps write and explain code." },
          { role: "user", content: userPrompt },
        ],
      });

      console.log("\n🤖 Codex says:\n");
      console.log(response.choices[0].message.content);
    } catch (err) {
      console.error("❌ Error:", err);
    }

    askCodex(); // loops so you can keep talking to Codex
  });
}

askCodex();

