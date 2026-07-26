// Production serverless function — POST /api/deanna/create-ministore.
// Injects the secret CREATE_MINISTORE_API_KEY and forwards to Deanna's external
// API, so the key never reaches the browser. This is what makes the "Crear
// MiniStore" button work on a deployed build (the Vite proxy is dev-only).
//
// Requires CREATE_MINISTORE_API_KEY (and optional DEANNA_API_BASE) in the env.
import { createMinistore } from "../../server/deanna-core.mjs";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }));
    return;
  }

  // Read the JSON body. Vercel may pre-parse it into req.body; a raw Node stream
  // (or if it didn't) is read manually. Handle both.
  let bodyString;
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    bodyString = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  } else {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    bodyString = Buffer.concat(chunks).toString("utf8");
  }

  const r = await createMinistore(bodyString, {
    apiKey: process.env.CREATE_MINISTORE_API_KEY,
    base: process.env.DEANNA_API_BASE,
  });
  res.statusCode = r.status;
  res.end(r.text);
}
