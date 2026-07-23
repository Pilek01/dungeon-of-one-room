import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("local Wrangler config is fixture-only and contains no secret", async () => {
  const [configText, packageText, lockText] = await Promise.all([
    readFile(new URL("../wrangler.local.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8")
  ]);
  const config = JSON.parse(configText);
  const packageJson = JSON.parse(packageText);
  const packageLock = JSON.parse(lockText);

  assert.equal(config.main, "src/local-fixture-entry.js");
  assert.equal(config.vars.ONLINE_V3_LOCAL_FIXTURE, "1");
  assert.equal(config.vars.ONLINE_V3_FIXTURE_SEASON, "fixture-season");
  assert.equal(config.d1_databases.length, 1);
  assert.equal(config.d1_databases[0].binding, "DB");
  assert.equal(
    config.d1_databases[0].database_id,
    "00000000-0000-0000-0000-000000000003"
  );
  assert.equal("RANKED_V3_HMAC_SECRET" in config.vars, false);
  assert.doesNotMatch(configText, /REPLACE_WITH_D1_DATABASE_ID|api[_-]?key|token\s*:/iu);
  assert.equal(packageJson.devDependencies.wrangler, "4.114.0");
  assert.equal(packageLock.packages["node_modules/wrangler"].version, "4.114.0");
});
