# HD1 artwork with default presentation improvements

**Goal:** Retain original HD1 artwork while enabling the approved loading, SFX,
VFX, status, death and animation timing improvements in the default game.
**Architecture:** Separate sprite catalog selection (existing optional hd2 query)
from presentation behavior. Use existing HD1 frames and counts, with no asset or
combat changes. Renderer streaming groups both catalogs and keeps idle fallbacks.
**Tech Stack:** JavaScript canvas, existing asset loader/audio, Node tests, Playwright.

## Steps
1. Add failing regressions in tests/hd1-presentation.test.js for default streaming,
   original catalog preservation, HD1 death frame count, event-driven attacks,
   stationary Totem, default SFX mute/rate limiting and missing-frame fallback.
2. Adapt render/hd2-actor-stream.js, render/hd2-presentation.js and
   render/hd-renderer-layers.js; remove artwork-dependent presentation gates in
   game.js. Keep real gameplay actions, RNG and all PNG files unchanged.
3. Update directly affected old tests only where the user explicitly changes
   expected presentation. Run focused Node tests and JavaScript syntax checks.
4. Inspect generator drift and regenerate source provenance only if required;
   verify canonical rules and active production bindings are unchanged.
5. Build current-tree preview serially. Verify default HD1 loading, death/removal/
   reward/expiry, statuses, SFX, and no HD2 asset requests in the browser.
   Run affected current-tree HD scenario and committed baseline; use phase when
   generated provenance changes. Inspect screenshots and run git diff --check.
6. Record results in progress.md. No commit, push or deployment in this task.
