// Forward a MiniStore-creation request to Deanna's external API with the secret
// x-api-key injected server-side. Shared by the Vite dev proxy and the Vercel
// serverless function, so the key never reaches the browser. deanna2u unchanged.
export async function createMinistore(bodyString, { apiKey, base }) {
  if (!apiKey) {
    return { status: 501, text: JSON.stringify({ error: "DEANNA_NOT_CONFIGURED" }) };
  }
  const b = (base || "https://deanna.pro").replace(/\/$/, "");
  try {
    const upstream = await fetch(`${b}/api/external/create-ministore`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: bodyString,
    });
    const text = await upstream.text();
    return { status: upstream.status, text };
  } catch (err) {
    return { status: 502, text: JSON.stringify({ error: String(err) }) };
  }
}
