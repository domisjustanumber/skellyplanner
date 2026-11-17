// Local dev server: rebuilds dist/index.html whenever src/ changes and live-reloads the browser.
// No dependencies. Usage: npm run dev   (PORT=xxxx to pick a port; default 5173)
//
// The page is served the way the Artifact host shows it: dist/index.html wrapped in a document
// with charset + viewport metas. Add ?theme=dark or ?theme=light to force a theme
// (sets data-theme on <html>); with no param it follows the OS setting.
const fs = require("fs");
const http = require("http");
const path = require("path");
const build = require("./build");

const SRC = path.join(__dirname, "src");
const START_PORT = Number(process.env.PORT) || 5173;
const clients = new Set();
let lastError = null;

function rebuild() {
  try {
    const html = build();
    lastError = null;
    console.log(`[${new Date().toLocaleTimeString()}] built dist/index.html (${html.length} bytes)`);
  } catch (err) {
    lastError = err;
    console.error(`[${new Date().toLocaleTimeString()}] build failed: ${err.message}`);
  }
  for (const res of clients) res.write("data: reload\n\n");
}

// Live reload over Server-Sent Events; also forwards page errors to this terminal.
const CLIENT = `
<script>
(() => {
  const es = new EventSource("/__reload");
  es.onmessage = () => location.reload();
  const report = (msg) => fetch("/__log", { method: "POST", body: String(msg) }).catch(() => {});
  addEventListener("error", (e) => report(e.message + " (" + (e.filename || "").split("/").pop() + ":" + e.lineno + ")"));
  addEventListener("unhandledrejection", (e) => report("Unhandled rejection: " + e.reason));
})();
</script>`;

function page(theme) {
  if (lastError) {
    const msg = String(lastError.stack || lastError).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return `<!doctype html><meta charset="utf-8"><title>Build failed</title>` +
      `<pre style="white-space:pre-wrap;font:14px monospace;padding:16px">Build failed\n\n${msg}</pre>${CLIENT}`;
  }
  const attr = theme === "dark" || theme === "light" ? ` data-theme="${theme}"` : "";
  return `<!doctype html>\n<html lang="en"${attr}>\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n` +
    fs.readFileSync(path.join(__dirname, "dist", "index.html"), "utf8") + CLIENT + "\n</body>\n</html>\n";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/__reload") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname === "/__log" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { console.error(`[browser] ${body}`); res.end(); });
    return;
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(page(url.searchParams.get("theme")));
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// Rebuild on any change in src/ (debounced: editors often fire several events per save).
let timer = null;
fs.watch(SRC, { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 80);
});

function listen(port) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && port < START_PORT + 20) return listen(port + 1);
    throw err;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Mocap Lens Calculator dev server: http://localhost:${port}`);
    console.log(`  dark: http://localhost:${port}/?theme=dark   light: http://localhost:${port}/?theme=light`);
    console.log("Watching src/ for changes. Ctrl+C to stop.");
  });
}

rebuild();
listen(START_PORT);
