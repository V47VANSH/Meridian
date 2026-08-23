/**
 * Render a Markdown document in this repo to PDF.
 *
 *   node docs/tools/build-pdf.mjs docs/11-final-report.md
 *   node docs/tools/build-pdf.mjs docs/11-final-report.md out/report.pdf
 *   STYLE=slides node docs/tools/build-pdf.mjs docs/13-presentation.md
 *
 * Markdown -> HTML with `marked`, then headless Chrome prints it to PDF. Chrome
 * is used rather than a PDF library because it is already on every machine that
 * can run the frontend, and because it renders the diagrams and tables with the
 * same engine that renders the app.
 *
 * Image paths are resolved relative to the source document, so `../db-design.png`
 * from inside `docs/` works exactly as it does on GitHub.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve, basename, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      "No Chrome or Edge found. Install one, or open the generated .html and " +
        "print it to PDF by hand — the stylesheet is already set up for A4.",
    );
  }
  return found;
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg) {
  console.error("usage: node docs/tools/build-pdf.mjs <source.md> [output.pdf]");
  process.exit(1);
}

const source = resolve(inputArg);
if (!existsSync(source)) throw new Error(`No such file: ${source}`);

const sourceDir = dirname(source);
const output = resolve(outputArg ?? source.replace(/\.md$/i, ".pdf"));
mkdirSync(dirname(output), { recursive: true });

const markdown = readFileSync(source, "utf8");

// `STYLE=slides` renders one `---` separated section per landscape page.
// Anything else uses the document stylesheet.
const styleName = process.env.STYLE === "slides" ? "slides.css" : "print.css";
const css = readFileSync(resolve(sourceDir, "tools", styleName), "utf8");

marked.setOptions({ gfm: true, breaks: false });
const body = marked.parse(markdown);

const title = (markdown.match(/^#\s+(.+)$/m)?.[1] ?? basename(source, extname(source))).trim();

// <base> makes relative image and link paths resolve against the source
// document's directory, which is what keeps `../db-design.png` working.
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<base href="${pathToFileURL(sourceDir).href}/">
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;

const htmlPath = output.replace(/\.pdf$/i, ".html");
writeFileSync(htmlPath, html, "utf8");

const chrome = findChrome();
execFileSync(
  chrome,
  [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    // Chrome will not load local images into a page it considers remote.
    "--allow-file-access-from-files",
    // No URL/date furniture on either output; the documents carry their own.
    "--no-pdf-header-footer",
    `--print-to-pdf=${output}`,
    pathToFileURL(htmlPath).href,
  ],
  { stdio: "inherit", timeout: 180_000 },
);

if (!existsSync(output)) throw new Error("Chrome exited without writing a PDF.");

// The intermediate HTML is a build artifact; keep it only if asked, since it is
// occasionally useful for debugging a layout problem.
if (!process.env.KEEP_HTML) rmSync(htmlPath, { force: true });

const size = (readFileSync(output).length / 1024).toFixed(0);
console.log(`Wrote ${output} (${size} KB)`);
