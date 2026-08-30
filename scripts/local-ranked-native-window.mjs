import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(nodeExecFile);
const DEFAULT_POWERSHELL = `${process.env.SystemRoot || "C:\\Windows"}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
const WINDOW_HELPER = fileURLToPath(new URL("./local-ranked-native-window.ps1", import.meta.url));

function integer(value, label) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized)) throw new TypeError(`${label} must be an integer.`);
  return normalized;
}

function normalizeNativeBounds(value) {
  return Object.freeze({
    left: integer(value?.left, "left"),
    top: integer(value?.top, "top"),
    width: integer(value?.width, "width"),
    height: integer(value?.height, "height")
  });
}

export function assertNativeWindowBounds(actualValue, expectedValue, tolerance = 2) {
  const actual = normalizeNativeBounds(actualValue);
  const expected = Object.freeze({
    left: integer(expectedValue?.x, "x"),
    top: integer(expectedValue?.y, "y"),
    width: integer(expectedValue?.width, "width"),
    height: integer(expectedValue?.height, "height")
  });
  const matches = Object.keys(expected).every((key) => Math.abs(actual[key] - expected[key]) <= tolerance);
  if (!matches) {
    throw new Error(
      `Native window placement mismatch: expected ${expected.left},${expected.top} ` +
      `${expected.width}x${expected.height}; received ${actual.left},${actual.top} ` +
      `${actual.width}x${actual.height}.`
    );
  }
  return actual;
}

export async function placeNativeChromeWindow(options) {
  const profileDir = String(options.bot?.profileDir || "");
  if (!profileDir) {
    throw new Error("Native window placement requires the isolated Chrome profile path.");
  }

  const execFile = options.execFile || execFileAsync;
  const { stdout } = await execFile(options.powershellExecutable || DEFAULT_POWERSHELL, [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", options.helperPath || WINDOW_HELPER,
    "-ProfileDir", profileDir,
    "-X", String(options.bounds.x),
    "-Y", String(options.bounds.y),
    "-Width", String(options.bounds.width),
    "-Height", String(options.bounds.height)
  ], {
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 64 * 1024
  });
  const line = String(stdout || "").trim().split(/\r?\n/u).at(-1);
  let observed;
  try {
    observed = JSON.parse(line);
  } catch {
    throw new Error("Native window placement returned no valid bounds.");
  }
  return assertNativeWindowBounds(observed, options.bounds);
}
