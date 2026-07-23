const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ACTIVE_AUDIO_PATHS = [
  "assets/Dungeon Descent.mp3",
  "assets/Haunted High Score.mp3",
  "assets/d40.mp3",
  "assets/the otter room doesnt exist.mp3",
  "assets/camp.mp3",
  "assets/One light left on the wall,.mp3",
  "assets/Dungeon Descent2.mp3",
  "assets/boss over 20.mp3",
  "assets/d40boss.mp3",
  "assets/Blue glow on my face.mp3",
  "assets/death.mp3",
  "assets/DEPTH 100.mp3",
  "assets/TRY AGAIN.mp3"
].sort();

const AUDIO_CONTRACT_SECTIONS = [
  "MUSIC_TRACKS",
  "SPLASH_TRACK",
  "DEATH_TRACK",
  "VICTORY_TRACK",
  "FINAL_GAME_OVER_TRACK",
  "DEEP_THEME_START_DEPTH",
  "ULTRA_THEME_START_DEPTH",
  "ensureSplashTrack",
  "ensureDeathTrack",
  "ensureVictoryTrack",
  "ensureFinalGameOverTrack",
  "createBgmTrack",
  "ensureBgmTracks",
  "playBgmTrack",
  "syncBgmWithState",
  "toggleAudio"
];

const AUDIO_CONTRACT_CONSTANTS = new Set([
  "MUSIC_TRACKS",
  "SPLASH_TRACK",
  "DEATH_TRACK",
  "VICTORY_TRACK",
  "FINAL_GAME_OVER_TRACK",
  "DEEP_THEME_START_DEPTH",
  "ULTRA_THEME_START_DEPTH"
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function scanJavaScript(source, startIndex, stopAtSemicolon) {
  const depth = { "(": 0, "[": 0, "{": 0 };
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "(" || char === "[" || char === "{") {
      depth[char] += 1;
      continue;
    }
    if (char === ")") depth["("] -= 1;
    if (char === "]") depth["["] -= 1;
    if (char === "}") depth["{"] -= 1;

    if (stopAtSemicolon) {
      if (char === ";" && depth["("] === 0 && depth["["] === 0 && depth["{"] === 0) {
        return index + 1;
      }
    } else if (char === "}" && depth["{"] === 0) {
      return index + 1;
    }
  }

  throw new Error(`Could not find the end of protected audio source starting at byte ${startIndex}`);
}

function closesControlHeader(maskedSource, closeParenIndex) {
  let depth = 0;
  for (let index = closeParenIndex; index >= 0; index -= 1) {
    const char = maskedSource[index];
    if (char === ")") {
      depth += 1;
      continue;
    }
    if (char !== "(") continue;
    depth -= 1;
    if (depth !== 0) continue;

    let wordEnd = index - 1;
    while (wordEnd >= 0 && /\s/.test(maskedSource[wordEnd])) wordEnd -= 1;
    let wordStart = wordEnd;
    while (wordStart >= 0 && /[a-zA-Z]/.test(maskedSource[wordStart])) wordStart -= 1;
    const keyword = maskedSource.slice(wordStart + 1, wordEnd + 1).join("");
    return ["if", "while", "for", "with", "switch", "catch"].includes(keyword);
  }
  return false;
}

function isRegexLiteralStart(maskedSource, slashIndex) {
  let previousIndex = slashIndex - 1;
  while (previousIndex >= 0 && /\s/.test(maskedSource[previousIndex])) previousIndex -= 1;
  if (previousIndex < 0) return true;

  const previous = maskedSource[previousIndex];
  if ("([{:;,=!?&|+-*%^~<>".includes(previous)) return true;
  if (previous === ")" && closesControlHeader(maskedSource, previousIndex)) return true;

  let wordStart = previousIndex;
  while (wordStart >= 0 && /[a-zA-Z]/.test(maskedSource[wordStart])) wordStart -= 1;
  const previousWord = maskedSource.slice(wordStart + 1, previousIndex + 1).join("");
  return [
    "return", "case", "throw", "delete", "void", "typeof",
    "instanceof", "in", "of", "yield", "await", "else", "do"
  ].includes(previousWord);
}

function maskCommentsAndStrings(source) {
  const masked = [];
  let state = "code";
  let quote = "";
  let escaped = false;
  let regexCharClass = false;

  const mask = (char) => char === "\n" ? "\n" : " ";

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "line-comment") {
      masked.push(mask(char));
      if (char === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      masked.push(mask(char));
      if (char === "*" && next === "/") {
        masked.push(" ");
        index += 1;
        state = "code";
      }
      continue;
    }
    if (state === "string") {
      masked.push(mask(char));
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
        state = "code";
      }
      continue;
    }
    if (state === "regex") {
      masked.push(mask(char));
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "[") {
        regexCharClass = true;
      } else if (char === "]") {
        regexCharClass = false;
      } else if (char === "/" && !regexCharClass) {
        state = "code";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      masked.push(" ", " ");
      index += 1;
      state = "line-comment";
      continue;
    }
    if (char === "/" && next === "*") {
      masked.push(" ", " ");
      index += 1;
      state = "block-comment";
      continue;
    }
    if (char === "/" && isRegexLiteralStart(masked, index)) {
      masked.push(" ");
      state = "regex";
      regexCharClass = false;
      escaped = false;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      masked.push(" ");
      quote = char;
      state = "string";
      continue;
    }
    masked.push(char);
  }

  return masked.join("");
}

function findSingleActiveDeclaration(maskedSource, matcher, kind, name) {
  const matches = [...maskedSource.matchAll(matcher)];
  if (matches.length === 0) {
    throw new Error(`Protected audio ${kind} not found in game.js: ${name}`);
  }
  if (matches.length > 1) {
    throw new Error(`Duplicate active protected audio ${kind} in game.js: ${name}`);
  }
  return matches[0];
}

function extractConstDeclaration(source, maskedSource, name) {
  const matcher = new RegExp(`\\bconst\\s+${name}\\s*=`, "g");
  const match = findSingleActiveDeclaration(maskedSource, matcher, "constant", name);
  const end = scanJavaScript(maskedSource, match.index, true);
  return source.slice(match.index, end);
}

function extractFunctionDeclaration(source, maskedSource, name) {
  const matcher = new RegExp(`\\bfunction\\s+${name}\\s*\\(`, "g");
  const match = findSingleActiveDeclaration(maskedSource, matcher, "function", name);
  const bodyStart = maskedSource.indexOf("{", match.index + match[0].length);
  if (bodyStart < 0) throw new Error(`Protected audio function has no body in game.js: ${name}`);
  const end = scanJavaScript(maskedSource, bodyStart, false);
  return source.slice(match.index, end);
}

function extractAudioContract(gameSource) {
  const source = gameSource.replace(/\r\n?/g, "\n");
  const maskedSource = maskCommentsAndStrings(source);
  return AUDIO_CONTRACT_SECTIONS.map((name) => {
    const declaration = AUDIO_CONTRACT_CONSTANTS.has(name)
      ? extractConstDeclaration(source, maskedSource, name)
      : extractFunctionDeclaration(source, maskedSource, name);
    return `// ${name}\n${declaration}`;
  }).join("\n\n");
}

function hashAudioContract(gameSource) {
  return sha256(extractAudioContract(gameSource));
}

function captureAudioBaseline(rootDir) {
  const files = ACTIVE_AUDIO_PATHS.map((relativePath) => {
    const absolutePath = path.join(rootDir, ...relativePath.split("/"));
    const bytes = fs.readFileSync(absolutePath);
    return {
      path: relativePath,
      sha256: sha256(bytes),
      size: bytes.length
    };
  });
  const gameSource = fs.readFileSync(path.join(rootDir, "game.js"), "utf8");

  return {
    schemaVersion: 1,
    audioContract: {
      sections: [...AUDIO_CONTRACT_SECTIONS],
      sha256: hashAudioContract(gameSource)
    },
    files
  };
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((sorted, key) => {
    sorted[key] = sortJsonValue(value[key]);
    return sorted;
  }, {});
}

function writeAudioBaseline(rootDir) {
  const fixturePath = path.join(rootDir, "tests", "fixtures", "audio-baseline.json");
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  const json = `${JSON.stringify(sortJsonValue(captureAudioBaseline(rootDir)), null, 2)}\n`;
  fs.writeFileSync(fixturePath, json, "utf8");
  return fixturePath;
}

if (require.main === module) {
  const rootDir = path.resolve(__dirname, "..");
  const fixturePath = writeAudioBaseline(rootDir);
  process.stdout.write(`Wrote deterministic audio baseline: ${fixturePath}\n`);
}

module.exports = {
  ACTIVE_AUDIO_PATHS,
  AUDIO_CONTRACT_SECTIONS,
  captureAudioBaseline,
  extractAudioContract,
  hashAudioContract,
  writeAudioBaseline
};
