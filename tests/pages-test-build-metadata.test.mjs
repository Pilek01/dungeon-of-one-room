import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "scripts", "build-pages-v3.mjs");

function linkedFirstPartyAssets(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gu)]
    .map((match) => match[1]);
  const styles = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"[^>]*>/gu)]
    .map((match) => match[1]);
  return [...styles, ...scripts].filter((value) =>
    !/^(?:[a-z]+:|\/\/|\/|#)/iu.test(value) &&
    /\.(?:css|js)(?:[?#]|$)/iu.test(value)
  );
}

test("test Pages build embeds the checked-out commit hash and date", async () => {
  const built = spawnSync(process.execPath, [builder, "--target", "test"], {
    cwd: root,
    env: process.env,
    encoding: "utf8"
  });
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);

  const expectedCommit = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const expectedDate = execFileSync("git", ["show", "-s", "--format=%cs", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const config = await readFile(path.join(root, "output", "pages-test-dist", "config.js"), "utf8");

  assert.match(config, new RegExp(`window\\.DUNGEON_BUILD_COMMIT = ${JSON.stringify(expectedCommit)}`));
  assert.match(config, new RegExp(`window\\.DUNGEON_BUILD_COMMIT_DATE = ${JSON.stringify(expectedDate)}`));

  const outputRoot = path.join(root, "output", "pages-test-dist");
  const [generatedIndex, sourceIndex] = await Promise.all([
    readFile(path.join(outputRoot, "index.html"), "utf8"),
    readFile(path.join(root, "index.html"), "utf8")
  ]);
  const generatedAssets = linkedFirstPartyAssets(generatedIndex);
  assert.ok(generatedAssets.length > 0);
  assert.ok(generatedAssets.includes(`online-v3/ranked-v3-recorder.js?v=${expectedCommit}`));
  for (const asset of generatedAssets) {
    const parsed = new URL(asset, "https://pages-build.invalid/");
    assert.equal(parsed.hash, "", asset);
    assert.equal(parsed.search, `?v=${expectedCommit}`, asset);
    assert.deepEqual([...parsed.searchParams.keys()], ["v"], asset);
    assert.equal(parsed.searchParams.getAll("v").length, 1, asset);
    const relativePath = decodeURIComponent(parsed.pathname.slice(1));
    await assert.doesNotReject(
      readFile(path.join(outputRoot, relativePath)),
      `Missing generated asset for ${asset}`
    );
  }

  const sourceAssets = linkedFirstPartyAssets(sourceIndex);
  assert.ok(sourceAssets.length > 0);
  assert.equal(sourceAssets.some((asset) => /[?#]/u.test(asset)), false);
  assert.equal(sourceIndex.includes("?v="), false);
});
