// Idealista OAuth + search. Shared by the Vite dev proxy and the Vercel function
// (api/idealista.js). Keeps the apikey/secret server-side. The token cache is
// per-process (fine: on serverless a cold start just re-auths; tokens are cheap).
let cached = null;

async function getToken(apiKey, apiSecret) {
  if (cached && Date.now() < cached.exp) return cached.token;
  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const res = await fetch("https://api.idealista.com/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=read",
  });
  if (!res.ok) throw new Error(`IDEALISTA_AUTH_${res.status}: ${await res.text()}`);
  const json = await res.json();
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in - 60) * 1000 };
  return cached.token;
}

async function search(token, lat, lng, distance, operation) {
  const body = new URLSearchParams({
    operation,
    propertyType: "homes",
    center: `${lat},${lng}`,
    distance,
    maxItems: "30",
    numPage: "1",
    locale: "es",
  });
  const res = await fetch("https://api.idealista.com/3.5/es/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`IDEALISTA_SEARCH_${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.elementList ?? []).map((e) => ({ ...e, operation }));
}

export async function idealistaListings({ lat, lng, distance, apiKey, apiSecret }) {
  if (!apiKey || !apiSecret) return { status: 501, json: { error: "IDEALISTA_NOT_CONFIGURED" } };
  if (!lat || !lng) return { status: 400, json: { error: "MISSING_LAT_LNG" } };
  try {
    const token = await getToken(apiKey, apiSecret);
    const d = distance || "150";
    const [sale, rent] = await Promise.all([
      search(token, lat, lng, d, "sale"),
      search(token, lat, lng, d, "rent"),
    ]);
    return { status: 200, json: { elementList: [...sale, ...rent] } };
  } catch (err) {
    return { status: 502, json: { error: String(err) } };
  }
}
