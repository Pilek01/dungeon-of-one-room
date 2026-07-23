import { createWorker } from "./index.js";
import { fixtureRuleset } from "../test/fixtures/fixture-ruleset.js";

const fixtureWorker = createWorker({ ruleset: fixtureRuleset });

export default {
  async fetch(request, env, context) {
    if (env.ONLINE_V3_LOCAL_FIXTURE !== "1") {
      return Response.json({
        ok: false,
        error: {
          code: "LOCAL_FIXTURE_DISABLED",
          message: "The local fixture entrypoint is disabled."
        }
      }, { status: 503 });
    }
    return fixtureWorker.fetch(request, env, context);
  }
};
