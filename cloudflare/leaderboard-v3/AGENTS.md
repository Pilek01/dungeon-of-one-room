# Online v3 Worker

These rules extend the repository root `AGENTS.md`.

## Domain boundary

- Keep pure ruleset and domain logic separate from HTTP, D1, and Cloudflare
  bindings.
- Do not import `game.js`, DOM APIs, renderers, audio, HUD, or Ranked v2 code.
- The browser game remains locally authoritative for combat presentation.

## Determinism and authority

- Do not use `Math.random()` for ruleset decisions.
- Use the versioned HMAC RNG with explicit purpose and counter domains.
- Retry, serialization, and restart must preserve the exact result.
- Client-provided gold, build, rarity, stacks, offers, modifiers, or score are
  never sources of truth.
- Unknown rules, IDs, versions, and hashes fail closed.

## Ruleset changes

- Every ruleset change must update canonical data, the manifest, and the
  resulting ruleset hash.
- Every rule needs active v0.8 source evidence, executable fixtures, and
  invariant/property tests.
- Do not guess unresolved baseline behavior or synthesize convenient success
  cases.
- `v08-meta-1` remains disconnected and test-only until an explicit release
  task authorizes activation.
- Active endpoints continue using the fixture ruleset unless
  the current user prompt explicitly permits a change and, when
  `docs/tasks/CURRENT.md` is `Status: ACTIVE`, that file permits it too.

## Protected Worker surfaces

Do not change D1, `recent_ops`, active endpoints, protocol contracts, or
Wrangler configuration unless the current user prompt explicitly permits the
exact paths and behavior and, when `docs/tasks/CURRENT.md` is
`Status: ACTIVE`, that file permits them too.

Run the verification levels required by the root instructions and current
task. Do not weaken schemas, assertions, fixtures, or fail-closed behavior.
