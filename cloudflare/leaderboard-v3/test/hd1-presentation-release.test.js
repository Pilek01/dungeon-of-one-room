import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as releases from '../src/rulesets/releases.js';
import {isCompatibleRulesetHashV08} from '../src/rulesets/v08-meta-1/ruleset-hash-policy.js';
import {createRequire} from 'node:module';
const protocol=createRequire(import.meta.url)('../../../online-v3/ranked-v3-protocol.js');
test('HD1 presentation candidate retains the deployed HD2 release and exact capabilities',()=>{
 const old='sha256:8c5c26851cbf440a62c2c2acf5f168fc13495de6601abd2e9681d6fa0f2d6c32';
 const previous=releases.V08_META_1_HD1_PRESENTATION_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
 assert.equal(previous?.rulesetHash,old);
 assert.deepEqual(previous.capabilities,releases.V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities);
 assert(isCompatibleRulesetHashV08(old));
 assert.equal(protocol.RULESET_HASH,releases.V08_META_1_PRODUCTION_RULESET_HASH);
 for(const [name,hashes]of Object.entries(protocol))if(name.endsWith('RULESET_HASHES')&&Array.isArray(hashes)&&hashes.includes(protocol.RULESET_HASH))assert(hashes.includes(old),name);
});
