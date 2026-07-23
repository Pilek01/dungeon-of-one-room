const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT_DIR = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.join(__dirname, "fixtures", "audio-baseline.json");
const CAPTURE_SCRIPT_PATH = path.join(ROOT_DIR, "scripts", "capture-audio-baseline.js");

const EXPECTED_AUDIO_PATHS = [
  "assets/Blue glow on my face.mp3",
  "assets/DEPTH 100.mp3",
  "assets/Dungeon Descent.mp3",
  "assets/Dungeon Descent2.mp3",
  "assets/Haunted High Score.mp3",
  "assets/One light left on the wall,.mp3",
  "assets/TRY AGAIN.mp3",
  "assets/boss over 20.mp3",
  "assets/camp.mp3",
  "assets/d40.mp3",
  "assets/d40boss.mp3",
  "assets/death.mp3",
  "assets/the otter room doesnt exist.mp3"
].sort();

const EXPECTED_AUDIO_CONTRACT_SECTIONS = [
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

function getContractSection(contract, name) {
  const marker = `// ${name}\n`;
  const markerIndex = contract.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Contract section is missing: ${name}`);
  const start = markerIndex + marker.length;
  const end = contract.indexOf("\n\n// ", start);
  return contract.slice(start, end === -1 ? undefined : end);
}

test("active soundtrack files and game.js audio contract match the approved baseline", () => {
  assert.ok(
    fs.existsSync(FIXTURE_PATH),
    `Audio baseline fixture is missing: ${FIXTURE_PATH}. Run node scripts/capture-audio-baseline.js only after approving the current soundtrack.`
  );

  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  const {
    AUDIO_CONTRACT_SECTIONS,
    captureAudioBaseline,
    hashAudioContract
  } = require(CAPTURE_SCRIPT_PATH);
  const current = captureAudioBaseline(ROOT_DIR);

  assert.equal(fixture.schemaVersion, 1, "Unexpected audio baseline schema version");
  assert.deepEqual(
    fixture.files.map((entry) => entry.path),
    EXPECTED_AUDIO_PATHS,
    "The fixture must contain exactly the 13 active audio files, sorted by path"
  );
  assert.deepEqual(
    current.files,
    fixture.files,
    "An active soundtrack file was renamed or its byte size/SHA-256 changed"
  );
  assert.deepEqual(
    AUDIO_CONTRACT_SECTIONS,
    EXPECTED_AUDIO_CONTRACT_SECTIONS,
    "The capture script must enumerate every protected soundtrack configuration section"
  );
  assert.deepEqual(
    fixture.audioContract.sections,
    EXPECTED_AUDIO_CONTRACT_SECTIONS,
    "The fixture must enumerate every protected soundtrack configuration section"
  );
  assert.equal(
    current.audioContract.sha256,
    fixture.audioContract.sha256,
    "The protected game.js audio contract changed (path, volume, loop, or selection logic)"
  );

  const source = fs.readFileSync(path.join(ROOT_DIR, "game.js"), "utf8").replace(/\r\n?/g, "\n");
  const approvedHash = hashAudioContract(source);
  const mutations = [
    ["path", '"assets/Dungeon Descent.mp3"', '"assets/Dungeon Descent.changed.mp3"'],
    ["volume", "createBgmTrack(MUSIC_TRACKS.normal, 0.36)", "createBgmTrack(MUSIC_TRACKS.normal, 0.37)"],
    ["loop", "track.loop = true", "track.loop = false"],
    ["selection logic", 'state.roomType === "otter"', 'state.roomType === "treasure"'],
    ["deep theme threshold", "const DEEP_THEME_START_DEPTH = 20;", "const DEEP_THEME_START_DEPTH = 21;"],
    ["ultra theme threshold", "const ULTRA_THEME_START_DEPTH = 40;", "const ULTRA_THEME_START_DEPTH = 41;"],
    [
      "BGM autoplay/play behavior",
      "function playBgmTrack(track) {\n    if (!track || state.audioMuted) return;\n    const playPromise = track.play();",
      "function playBgmTrack(track) {\n    if (!track || state.audioMuted) return;\n    const playPromise = Promise.resolve();"
    ],
    [
      "mute toggle behavior",
      "function toggleAudio() {\n    state.audioMuted = !state.audioMuted;",
      "function toggleAudio() {\n    state.audioMuted = false;"
    ]
  ];

  for (const [label, before, after] of mutations) {
    assert.ok(source.includes(before), `Test precondition failed: protected ${label} source was not found`);
    const mutatedSource = source.replace(before, after);
    assert.notEqual(
      hashAudioContract(mutatedSource),
      approvedHash,
      `A protected ${label} change must alter the audio-contract hash`
    );
  }
});

test("commented or stringified stale declarations cannot hide an active audio change", () => {
  const { extractAudioContract, hashAudioContract } = require(CAPTURE_SCRIPT_PATH);
  const source = fs.readFileSync(path.join(ROOT_DIR, "game.js"), "utf8").replace(/\r\n?/g, "\n");
  const approvedHash = hashAudioContract(source);
  const approvedSync = getContractSection(extractAudioContract(source), "syncBgmWithState");
  const changedSync = approvedSync.replace(
    'state.roomType === "otter"',
    'state.roomType === "treasure"'
  );
  assert.notEqual(changedSync, approvedSync, "Test precondition failed: sync selection logic was not changed");

  const staleCommentBeforeActive = source.replace(
    approvedSync,
    `/* stale declaration\n${approvedSync}\n*/\n${changedSync}`
  );
  assert.notEqual(
    hashAudioContract(staleCommentBeforeActive),
    approvedHash,
    "A block-commented stale function must not hide a changed active syncBgmWithState"
  );

  const staleStringBeforeActive = source.replace(
    approvedSync,
    `const staleAudioSource = ${JSON.stringify(approvedSync)};\n${changedSync}`
  );
  assert.notEqual(
    hashAudioContract(staleStringBeforeActive),
    approvedHash,
    "A stringified stale function must not hide a changed active syncBgmWithState"
  );
});

test("audio contract extraction rejects missing or duplicate active declarations", () => {
  const { extractAudioContract } = require(CAPTURE_SCRIPT_PATH);
  const source = fs.readFileSync(path.join(ROOT_DIR, "game.js"), "utf8").replace(/\r\n?/g, "\n");
  const approvedSync = getContractSection(extractAudioContract(source), "syncBgmWithState");

  assert.throws(
    () => extractAudioContract(source.replace(approvedSync, "")),
    /not found.*syncBgmWithState|syncBgmWithState.*not found/i,
    "A missing active declaration must fail explicitly"
  );
  assert.throws(
    () => extractAudioContract(`${source}\n${approvedSync}\n`),
    /duplicate.*syncBgmWithState|syncBgmWithState.*duplicate/i,
    "Duplicate active declarations must fail explicitly"
  );
});

test("statement-position regex after a control condition is ignored during declaration discovery", () => {
  const { hashAudioContract } = require(CAPTURE_SCRIPT_PATH);
  const source = fs.readFileSync(path.join(ROOT_DIR, "game.js"), "utf8").replace(/\r\n?/g, "\n");
  const sourceWithRegex = source.replace(
    "(() => {",
    "(() => {\n  if (true) /const MUSIC_TRACKS =/.test(value);"
  );
  assert.notEqual(sourceWithRegex, source, "Test precondition failed: statement-position regex was not inserted");
  assert.equal(
    hashAudioContract(sourceWithRegex),
    hashAudioContract(source),
    "A regex after a control-header parenthesis must not be discovered as an active declaration"
  );
});

test("a closing brace inside a regex cannot truncate protected function extraction", () => {
  const { extractAudioContract, hashAudioContract } = require(CAPTURE_SCRIPT_PATH);
  const source = fs.readFileSync(path.join(ROOT_DIR, "game.js"), "utf8").replace(/\r\n?/g, "\n");
  const approvedSync = getContractSection(extractAudioContract(source), "syncBgmWithState");
  const syncWithBraceRegex = approvedSync.replace(
    "function syncBgmWithState(force = false) {",
    'function syncBgmWithState(force = false) {\n    if (true) /[}]/.test("probe");'
  );
  const changedSyncWithBraceRegex = syncWithBraceRegex.replace(
    'state.roomType === "otter"',
    'state.roomType === "treasure"'
  );
  assert.notEqual(syncWithBraceRegex, approvedSync, "Test precondition failed: brace regex was not inserted");
  assert.notEqual(
    changedSyncWithBraceRegex,
    syncWithBraceRegex,
    "Test precondition failed: active audio selection logic was not changed"
  );

  const sourceWithBraceRegex = source.replace(approvedSync, syncWithBraceRegex);
  const changedSourceWithBraceRegex = source.replace(approvedSync, changedSyncWithBraceRegex);
  assert.notEqual(
    hashAudioContract(changedSourceWithBraceRegex),
    hashAudioContract(sourceWithBraceRegex),
    "A real selection change after a brace-bearing regex must alter the protected contract hash"
  );
});
