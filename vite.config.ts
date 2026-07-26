import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { facadeCore } from "./server/facade-core.mjs";
import { idealistaListings } from "./server/idealista-core.mjs";
import { createMinistore } from "./server/deanna-core.mjs";

// ---------------------------------------------------------------------------
// Dev-only middlewares that MIRROR the production serverless functions in /api,
// sharing the same cores in ./server so /api/* behaves identically in
// `npm run dev` and on Vercel. Secrets stay server-side either way.
//   Prod equivalents: api/idealista.js · api/deanna/create-ministore.js ·
//   api/facade.js  (+ vercel.json rewrite for /pvgis).
// ---------------------------------------------------------------------------
function idealistaProxy(apiKey?: string, apiSecret?: string): Plugin {
  return {
    name: "idealista-proxy",
    configureServer(server) {
      server.middlewares.use("/api/idealista", async (req, res) => {
        const u = new URL(req.url ?? "", "http://localhost");
        const r = await idealistaListings({
          lat: u.searchParams.get("lat"),
          lng: u.searchParams.get("lng"),
          distance: u.searchParams.get("distance"),
          apiKey,
          apiSecret,
        });
        res.statusCode = r.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(r.json));
      });
    },
  };
}

function deannaProxy(apiKey?: string, apiBase?: string): Plugin {
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
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const r = await createMinistore(Buffer.concat(chunks).toString("utf8"), {
          apiKey,
          base: apiBase,
        });
        res.statusCode = r.status;
        res.end(r.text);
      });
    },
  };
}

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
    // Dev-only host proxies. In production these are handled by vercel.json
    // rewrites (/pvgis). Catastro live WFS isn't used by the default snapshot
    // source, so it's dev-only convenience here.
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
