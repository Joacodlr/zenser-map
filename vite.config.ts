import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { facadeCore } from "./api/_facade-core.mjs";

// ---------------------------------------------------------------------------
// Dev-only Idealista proxy. Runs INSIDE the Vite dev server (Node), so:
//   - your apikey/secret never reach the browser
//   - there is no CORS problem (the browser calls same-origin /api/idealista)
// It caches the OAuth token and does one search per operation (sale + rent).
// NOTE: this only exists during `npm run dev`. For a static production deploy,
// move this same logic into a serverless function.
// ---------------------------------------------------------------------------
function idealistaProxy(apiKey?: string, apiSecret?: string): Plugin {
  let cached: { token: string; exp: number } | null = null;

  async function getToken(): Promise<string> {
    if (cached && Date.now() < cached.exp) return cached.token;
    const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const res = await fetch("https://api.idealista.com/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=read",
    });
    if (!res.ok) throw new Error(`IDEALISTA_AUTH_${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    // refresh 60s before expiry
    cached = { token: json.access_token, exp: Date.now() + (json.expires_in - 60) * 1000 };
    return cached.token;
  }

  async function search(token: string, lat: string, lng: string, distance: string, operation: "sale" | "rent") {
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
    const json = (await res.json()) as { elementList?: any[] };
    return (json.elementList ?? []).map((e) => ({ ...e, operation }));
  }

  return {
    name: "idealista-proxy",
    configureServer(server) {
      server.middlewares.use("/api/idealista", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (!apiKey || !apiSecret) {
          res.statusCode = 501;
          res.end(JSON.stringify({ error: "IDEALISTA_NOT_CONFIGURED" }));
          return;
        }
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const lat = url.searchParams.get("lat") ?? "";
          const lng = url.searchParams.get("lng") ?? "";
          const distance = url.searchParams.get("distance") ?? "150";
          if (!lat || !lng) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "MISSING_LAT_LNG" }));
            return;
          }
          const token = await getToken();
          const [sale, rent] = await Promise.all([
            search(token, lat, lng, distance, "sale"),
            search(token, lat, lng, distance, "rent"),
          ]);
          res.statusCode = 200;
          res.end(JSON.stringify({ elementList: [...sale, ...rent] }));
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Dev-only Deanna MiniStore proxy. The browser POSTs building data to the
// same-origin /api/deanna/create-ministore; this middleware (running in Node)
// injects the secret x-api-key and forwards to the Deanna external endpoint, so
// the key NEVER reaches the client bundle or Network tab. Like the Idealista
// proxy, this only exists during `npm run dev`; for a static production deploy,
// move this same forwarding logic into a serverless function.
// ---------------------------------------------------------------------------
function deannaProxy(apiKey?: string, apiBase?: string): Plugin {
  const base = (apiBase || "https://deanna.pro").replace(/\/$/, "");
  return {
    name: "deanna-proxy",
    configureServer(server) {
      server.middlewares.use("/api/deanna/create-ministore", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }));
          return;
        }
        if (!apiKey) {
          res.statusCode = 501;
          res.end(JSON.stringify({ error: "DEANNA_NOT_CONFIGURED" }));
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = Buffer.concat(chunks).toString("utf8");
          const upstream = await fetch(`${base}/api/external/create-ministore`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body,
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.end(text);
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

// Dev-only building-facade endpoint (Google Street View), mirroring the
// production serverless function at api/facade.js — same shared core, so /api/facade
// behaves identically in `npm run dev` and in a deployed build. Key stays server-side.
function facadeProxy(apiKey?: string): Plugin {
  return {
    name: "facade-proxy",
    configureServer(server) {
      server.middlewares.use("/api/facade", async (req, res) => {
        const u = new URL(req.url ?? "", "http://localhost");
        const r = await facadeCore({
          lat: u.searchParams.get("lat"),
          lng: u.searchParams.get("lng"),
          meta: u.searchParams.get("meta") === "1",
          size: u.searchParams.get("size"),
          fov: u.searchParams.get("fov"),
          key: apiKey,
        });
        res.statusCode = r.status;
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (r.body) {
          res.setHeader("Content-Type", r.contentType!);
          res.setHeader("Cache-Control", "public, max-age=2592000");
          res.end(r.body);
        } else {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(r.json));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv with an empty prefix reads ALL vars (incl. non-VITE_ server secrets).
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      idealistaProxy(env.IDEALISTA_API_KEY, env.IDEALISTA_API_SECRET),
      deannaProxy(env.CREATE_MINISTORE_API_KEY, env.DEANNA_API_BASE),
      facadeProxy(env.GOOGLE_MAPS_API_KEY),
    ],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: {
      proxy: {
        "/catastro": {
          target: "https://ovc.catastro.meh.es",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/catastro/, ""),
        },
        "/catastro-ovc": {
          target: "http://ovc.catastro.meh.es",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/catastro-ovc/, ""),
        },
        "/pvgis": {
          target: "https://re.jrc.ec.europa.eu",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/pvgis/, ""),
        },
      },
    },
  };
});