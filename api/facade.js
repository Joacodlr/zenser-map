// Production serverless function for the building facade (Google Street View).
// On Vercel/Netlify-style hosts, a file in /api becomes GET /api/facade.
// Serves the image (or a {available} JSON for ?meta=1) with the Google key kept
// server-side. Deanna stores a URL pointing here; the key never reaches a browser.
//
// Requires GOOGLE_MAPS_API_KEY in this app's deployment environment.
import { facadeCore } from "./_facade-core.mjs";

export default async function handler(req, res) {
  const u = new URL(req.url, "http://localhost");
  const r = await facadeCore({
    lat: u.searchParams.get("lat"),
    lng: u.searchParams.get("lng"),
    meta: u.searchParams.get("meta") === "1",
    size: u.searchParams.get("size"),
    fov: u.searchParams.get("fov"),
    key: process.env.GOOGLE_MAPS_API_KEY,
  });

  res.statusCode = r.status;
  // <img> loads are cross-origin (Deanna renders this); harmless to allow.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (r.body) {
    res.setHeader("Content-Type", r.contentType);
    res.setHeader("Cache-Control", "public, max-age=2592000"); // 30d — imagery is static
    res.end(r.body);
  } else {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(r.json));
  }
}
