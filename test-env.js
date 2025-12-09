import dotenv from "dotenv"; dotenv.config(); console.log("Loaded key:", process.env.OPENAI_API_KEY ? "? Found!" : "? Missing!"); 
