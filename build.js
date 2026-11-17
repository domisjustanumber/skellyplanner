// Builds dist/index.html: one self-contained page (the Artifact host wraps it in <html>/<head>/<body>).
const fs = require("fs");
const path = require("path");

function build() {
  const r = (f) => fs.readFileSync(path.join(__dirname, "src", f), "utf8");
  const engine = r("engine.js").replace('if (typeof module !== "undefined") module.exports = ENGINE;', "");
  const html = r("head.html") + "<style>\n" + r("styles.css") + "</style>\n\n" + r("body.html") +
    "\n<script>\n" + engine + "\n" + r("page.js") + "</script>\n";
  fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "dist", "index.html"), html);
  return html;
}

if (require.main === module) {
  const html = build();
  console.log(`dist/index.html ${html.length} bytes`);
}

module.exports = build;
