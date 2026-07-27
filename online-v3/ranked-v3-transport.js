(function exposeRankedV3Transport(root, factory) {
  "use strict";

  const api = factory(root?.DungeonRankedV3Protocol);
  if (root) root.DungeonRankedV3Transport = api;
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ranked-v3-protocol.js"));
  }
})(typeof globalThis === "object" ? globalThis : null, function createTransportModule(protocol) {
  "use strict";

  class RankedV3HttpError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = "RankedV3HttpError";
      this.status = Number(details.status) || 0;
      this.code = String(details.code || "NETWORK_ERROR");
      this.traceId = String(details.traceId || "");
      this.retryable = Boolean(details.retryable);
      this.conflict = this.status === 409;
    }
  }

  function randomOperationId(cryptoProvider = globalThis.crypto) {
    if (typeof cryptoProvider?.randomUUID === "function") {
      return `op_${cryptoProvider.randomUUID().replaceAll("-", "")}`;
    }
    const bytes = new Uint8Array(16);
    if (typeof cryptoProvider?.getRandomValues !== "function") {
      throw new TypeError("OPERATION_ID_CRYPTO_UNAVAILABLE");
    }
    cryptoProvider.getRandomValues(bytes);
    return `op_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  function redact(value) {
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      /token|authorization|digest|credential/iu.test(key) ? "[redacted]" : redact(entry)
    ]));
  }

  function joinUrl(baseUrl, path) {
    const base = String(baseUrl || "").replace(/\/+$/u, "");
    return `${base}${path}`;
  }

  function createTransport(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== "function") throw new TypeError("RANKED_TRANSPORT_FETCH_UNAVAILABLE");
    const policy = { ...protocol.RETRY_POLICY, ...(options.retryPolicy || {}) };
    const log = typeof options.log === "function" ? options.log : () => {};
    const wait = options.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

    async function request(endpoint, requestOptions = {}) {
      const operationId = requestOptions.operationId || (
        endpoint.method === "GET" ? "" : randomOperationId(options.cryptoProvider)
      );
      const bodyText = requestOptions.body === undefined
        ? undefined
        : JSON.stringify(requestOptions.body);
      let lastError;
      for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort("timeout"), policy.timeoutMs);
        try {
          log("request", redact({
            path: endpoint.path,
            operationId,
            attempt,
            body: requestOptions.body
          }));
          const response = await fetchImpl(joinUrl(options.baseUrl, endpoint.path), {
            method: endpoint.method,
            headers: {
              accept: "application/json",
              ...(bodyText === undefined ? {} : { "content-type": "application/json" }),
              ...(operationId ? { "Idempotency-Key": operationId } : {})
            },
            body: bodyText,
            signal: controller.signal
          });
          let payload = null;
          try {
            payload = await response.json();
          } catch {
            throw new RankedV3HttpError("Worker returned an unreadable response.", {
              status: response.status,
              code: "RESPONSE_NOT_JSON"
            });
          }
          if (response.ok) {
            log("response", redact({ path: endpoint.path, operationId, status: response.status }));
            return Object.freeze({ payload, operationId, replayed: response.headers?.get?.("x-idempotent-replay") === "1" });
          }
          const retryable = policy.retryableStatus.includes(response.status);
          throw new RankedV3HttpError(
            payload?.error?.message || payload?.message || "Online v3 request failed.",
            {
              status: response.status,
              code: payload?.error?.code || payload?.code || "HTTP_ERROR",
              traceId: payload?.traceId,
              retryable
            }
          );
        } catch (cause) {
          lastError = cause instanceof RankedV3HttpError
            ? cause
            : new RankedV3HttpError(
                cause?.name === "AbortError" ? "Online v3 request timed out." : "Online v3 is unreachable.",
                { code: cause?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR", retryable: true }
              );
          if (!lastError.retryable || attempt >= policy.maxAttempts) throw lastError;
          await wait(Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** (attempt - 1))));
        } finally {
          clearTimeout(timeout);
        }
      }
      throw lastError;
    }

    return Object.freeze({
      request,
      createOperationId: () => randomOperationId(options.cryptoProvider)
    });
  }

  return Object.freeze({
    RankedV3HttpError,
    createTransport,
    randomOperationId,
    redact
  });
});
