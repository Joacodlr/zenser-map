// Shared Street View facade logic, used by BOTH the Vite dev proxy
// (vite.config.ts) and the production serverless function (api/facade.js).
// Lives in the MAP app — not deanna2u — so the Google key stays in this app's
// environment and Deanna's code is never touched. Kept OUTSIDE /api so Vercel
// doesn't try to treat it as its own endpoint.
//
// The metadata request is free; we only fetch the (paid) image when imagery
// exists, so a store never ends up with a broken/blank facade.

const SV = "https://maps.googleapis.com/maps/api/streetview";
const SV_META = "https://maps.googleapis.com/maps/api/streetview/metadata";

export async function facadeCore({ lat, lng, meta, size, fov, key }) {
  if (!key) {
    return { status: 501, json: { error: "GOOGLE_MAPS_API_KEY not configured" } };
  }
  if (!lat || !lng) {
    return { status: 400, json: { error: "lat and lng are required" } };
  }

  const location = `${lat},${lng}`;

  try {
    // 1. Free metadata check — is there Street View imagery here?
    const metaRes = await fetch(`${SV_META}?location=${location}&source=outdoor&key=${key}`);
    const m = await metaRes.json();
    const available = m.status === "OK";

    if (meta) {
      return { status: 200, json: { available, status: m.status ?? "UNKNOWN" } };
    }
    if (!available) {
      return { status: 404, json: { error: "NO_IMAGERY", status: m.status } };
    }

    // 2. Fetch the actual Street View Static image (key stays server-side).
    const imgRes = await fetch(
      `${SV}?size=${size || "640x420"}&location=${location}&fov=${fov || "80"}&source=outdoor&return_error_code=true&key=${key}`,
    );
    if (!imgRes.ok) {
      return { status: 502, json: { error: `STREETVIEW_${imgRes.status}` } };
    }
    const body = Buffer.from(await imgRes.arrayBuffer());
    return { status: 200, contentType: imgRes.headers.get("content-type") || "image/jpeg", body };
  } catch (err) {
    return { status: 502, json: { error: String(err) } };
  }
}
