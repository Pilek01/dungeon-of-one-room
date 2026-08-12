import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  injectCheckoutBuildIdentity,
  readCurrentCheckoutBuildIdentity
} from "./current-checkout-build-metadata.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = 8091;
const ROOT_RUNTIME_EXTENSIONS = new Set([".css", ".html", ".js"]);
const ASSET_EXTENSIONS = new Set([
  ".gif", ".jpeg", ".jpg", ".json", ".mp3", ".ogg", ".png", ".svg", ".wav", ".webp"
]);
const RUNTIME_DIRECTORIES = new Set(["assets", "online-v3", "render"]);
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webp": "image/webp"
});

function cliValue(prefix) {
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

function isAllowedRuntimePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  const extension = path.extname(normalized).toLowerCase();
  if (parts.length === 1) {
    return ROOT_RUNTIME_EXTENSIONS.has(extension);
  }
  return RUNTIME_DIRECTORIES.has(parts[0]) &&
    (extension === ".js" || extension === ".css" || ASSET_EXTENSIONS.has(extension));
}

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

export async function startMobilePreviewServer({ host = "127.0.0.1", port = 0 } = {}) {
  if (host === "0.0.0.0" || host === "::") {
    throw new Error("Use one explicit LAN IPv4 address instead of all interfaces.");
  }
  const buildIdentity = readCurrentCheckoutBuildIdentity(ROOT);
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://preview.local");
      let relativePath = decodeURIComponent(requestUrl.pathname);
      while (relativePath.startsWith("/")) relativePath = relativePath.slice(1);
      if (!relativePath) relativePath = "index.html";
      if (!isAllowedRuntimePath(relativePath)) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" }).end("Forbidden");
        return;
      }
      const filePath = path.resolve(ROOT, relativePath);
      const rootWithSeparator = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
      if (!filePath.startsWith(rootWithSeparator)) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" }).end("Forbidden");
        return;
      }
      const source = await fs.readFile(filePath);
      const body = relativePath === "config.js"
        ? injectCheckoutBuildIdentity(source, buildIdentity)
        : source;
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": contentType(filePath)
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  if (!address || typeof address !== "object") throw new Error("Preview server did not expose an address.");
  return {
    server,
    root: ROOT,
    url: `http://${host}:${address.port}/`
  };
}

async function main() {
  const host = cliValue("--host=") || "127.0.0.1";
  const port = Number(cliValue("--port=") || DEFAULT_PORT);
  const preview = await startMobilePreviewServer({ host, port });
  console.log("Dungeon mobile v1 preview (runtime allowlist only)");
  console.log(`Worktree: ${preview.root}`);
  console.log(`URL:      ${preview.url}`);
  console.log("Keep this terminal open. Stop with Ctrl+C.");
  const close = () => preview.server.close(() => process.exit(0));
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
