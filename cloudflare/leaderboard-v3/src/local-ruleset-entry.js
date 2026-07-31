import { createWorker } from "./index.js";
import { createRulesetRegistry } from "./rulesets/registry.js";
import {
  V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
  V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR
} from "./rulesets/releases.js";

const localRegistry = createRulesetRegistry([
  V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR,
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR
]);
const localWorker = createWorker({
  rulesetRegistry: localRegistry,
  rulesetEnvironment: "local",
  onError(cause) {
    console.error("Online v3 local Worker error", cause);
  }
});

export default {
  async fetch(request, env, context) {
    if (env.ONLINE_V3_LOCAL_RULESET !== "v08-meta-1") {
      return Response.json({
        ok: false,
        error: {
          code: "LOCAL_RULESET_DISABLED",
          message: "The local real-ruleset entrypoint is disabled."
        }
      }, { status: 503 });
    }
    return localWorker.fetch(request, env, context);
  }
};
