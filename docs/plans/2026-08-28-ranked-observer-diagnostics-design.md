# Ranked Observer diagnostics design

Date: 2026-08-28
Status: APPROVED IN CHAT

## Problem

When a Ranked request fails with `INTERNAL_ERROR`, the browser preserves a
small local diagnostic entry and the Worker emits a structured log. The player
overlay does not expose the request trace ID, the Observer Bot trace does not
include Ranked diagnostics, and the two records cannot be correlated from the
exported bot trace. A later retry can replace the visible symptom with a
secondary error such as `TOKEN_EXPIRED`, obscuring the original failure.

## Selected approach

Use one correlated, redacted diagnostic path across the Ranked browser runtime,
Observer Bot trace, and Worker error log. Do not add a D1 table or migration,
change canonical state, alter anti-cheat decisions, or change gameplay.

Client diagnostics will retain the original error as the recovery root and add
safe request context: trace ID, operation ID, endpoint, event action, directive
ID, depth, room type, revision, session state, and build identity. Tokens,
credentials, request digests, and complete request bodies remain excluded.

The reconnect UI will show the trace ID and offer a diagnostic export. The
export will contain the bounded Ranked diagnostic history plus a redacted
snapshot of the pending operation and public state. Observer Bot runs will also
record a forced `ranked_error` trace event so the existing bot export carries
the same correlation fields even if play later resumes or a new run starts.

Worker diagnostics will keep the existing public `INTERNAL_ERROR` response but
enrich the structured log with safe request metadata extracted from a cloned
request: run ID, idempotency operation ID, event type, directive ID, and client
protocol version. The raw body and all secrets remain unlogged.

## Error handling and retention

The first failure remains the recovery root diagnostic. Secondary retry or
resync failures are recorded separately and cannot overwrite that root. Both
client histories stay bounded. Export failures must not change Ranked session
state or resume Observer Bot automation.

## Verification

Test-first regressions will cover client redaction, root-error retention,
Observer Bot correlation, export content, Worker request-context extraction,
and structured logging. Verification will include focused tests, JavaScript
syntax checks, `git diff --check`, the Ranked recovery browser scenario, the
protected baseline because `game.js` changes, and the required cross-subsystem
phase gate. No deployment, push, ruleset activation, or D1 migration is part of
this task.
