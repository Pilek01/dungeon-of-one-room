export async function onRequest(context) {
  const backend = context.env.RANKED_V3_BACKEND;
  if (!backend || typeof backend.fetch !== "function") {
    return Response.json({
      ok: false,
      error: {
        code: "RANKED_V3_BACKEND_UNAVAILABLE",
        message: "Ranked is temporarily unavailable."
      }
    }, {
      status: 503,
      headers: { "cache-control": "no-store" }
    });
  }
  return backend.fetch(context.request);
}
