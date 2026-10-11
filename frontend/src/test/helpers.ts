export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Stub fetch global yang merekam panggilan. */
export function stubFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(handler);
  vi.stubGlobal("fetch", fn);
  return fn;
}
