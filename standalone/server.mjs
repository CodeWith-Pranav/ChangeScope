import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { api } from "../core/http.mjs";
const root = new URL("../public/", import.meta.url);
const assets = {
  "/": ["index.html", "text/html"],
  "/client.js": ["client.js", "text/javascript"],
  "/styles.css": ["styles.css", "text/css"],
  "/favicon.svg": ["favicon.svg", "image/svg+xml"],
};
export function createApp({
  trustProxy = process.env.TRUST_PROXY === "1",
} = {}) {
  return createServer(async (req, res) => {
    try {
      const protocol =
        trustProxy && req.headers["x-forwarded-proto"] === "https"
          ? "https:"
          : "http:";
      const base = protocol + "//" + (req.headers.host || "localhost");
      const url = new URL(req.url, base);
      if (
        !req.url.startsWith("/") ||
        req.url.startsWith("//") ||
        url.origin !== new URL(base).origin
      ) {
        res.writeHead(400);
        res.end("Invalid request target");
        return;
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      );
      if (url.pathname.startsWith("/api/")) {
        const chunks = [];
        let n = 0;
        for await (const c of req) {
          n += c.length;
          if (n > 1400000) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end('{"error":"Request exceeds 1.4 MB."}');
            return;
          }
          chunks.push(c);
        }
        const r = await api(
          new Request(url, {
            method: req.method,
            headers: req.headers,
            ...(["GET", "HEAD"].includes(req.method)
              ? {}
              : { body: Buffer.concat(chunks) }),
          }),
        );
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const asset = assets[url.pathname];
      if (!asset) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.setHeader("Content-Type", asset[1] + "; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(
        req.method === "HEAD"
          ? undefined
          : await readFile(new URL(asset[0], root)),
      );
    } catch {
      res.writeHead(500);
      res.end("Server error");
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  const server = createApp();
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.listen(port, host, () =>
    console.log(`ChangeScope listening at http://${host}:${port}`),
  );
}
