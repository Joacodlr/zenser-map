// Production serverless function for Idealista listings — GET /api/idealista.
// Keeps IDEALISTA_API_KEY / IDEALISTA_API_SECRET server-side. The client falls
// back to mock data if this is missing/errors, so it's optional.
import { idealistaListings } from "../server/idealista-core.mjs";

export default async function handler(req, res) {
  const u = new URL(req.url, "http://localhost");
  const r = await idealistaListings({
    lat: u.searchParams.get("lat"),
    lng: u.searchParams.get("lng"),
    distance: u.searchParams.get("distance"),
    apiKey: process.env.IDEALISTA_API_KEY,
    apiSecret: process.env.IDEALISTA_API_SECRET,
  });
  res.statusCode = r.status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(r.json));
}
