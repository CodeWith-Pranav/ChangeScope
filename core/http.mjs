import { analyze } from "./analyzer.mjs";
import { sample } from "./sample.mjs";
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function api(request) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/sample")
    return new Response(JSON.stringify(sample), { headers });
  if (request.method === "GET" && url.pathname === "/api/health")
    return new Response(JSON.stringify({ status: "ok", version: "1.0.0" }), {
      headers,
    });
  if (url.pathname !== "/api/analyze")
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers,
    });
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin)
    return new Response(
      JSON.stringify({ error: "Cross-origin requests are not allowed." }),
      { status: 403, headers },
    );
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("A JSON request body is required.");
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1400000) {
        await reader.cancel();
        return new Response(
          JSON.stringify({ error: "Request exceeds 1.4 MB." }),
          { status: 413, headers },
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.length;
    }
    const result = analyze(JSON.parse(new TextDecoder().decode(bytes)));
    return new Response(JSON.stringify(result), { headers });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error:
          e instanceof SyntaxError
            ? "Request must contain valid JSON."
            : e.message || "Analysis failed.",
      }),
      { status: 400, headers },
    );
  }
}
