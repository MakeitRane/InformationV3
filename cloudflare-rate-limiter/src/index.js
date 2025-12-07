import { DurableObject } from "cloudflare:workers";

// Durable Object implementing per-IP rate limiting:
// - 3 requests per second (token bucket, average rate per IP)
// - 100 requests per calendar day in America/New_York (EST/EDT) per IP
export class RateLimiter extends DurableObject {
  static rps = 3;                // target requests per second
  static perSecondCapacity = 3;  // max tokens at once
  static dayLimit = 100;         // max requests per calendar day (per IP, US Eastern)

  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;

    // In-memory defaults; real state is loaded from storage
    this.state = {
      tokens: RateLimiter.perSecondCapacity,
      lastRefill: Date.now(),
      dayCount: 0,
      // dayKey is "YYYY-MM-DD" in America/New_York for the calendar day
      dayKey: null
    };
    this.initialized = false;
  }

  async #loadState() {
    if (this.initialized) return;
    const stored = await this.ctx.storage.get("rate_state");
    if (stored && typeof stored === "object") {
      this.state = stored;
    }
    this.initialized = true;
  }

  async #saveState() {
    await this.ctx.storage.put("rate_state", this.state);
  }

  // Get a stable calendar-day key in America/New_York, e.g. "2025-02-12"
  #getEstDayKey(nowMs) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const parts = formatter.formatToParts(new Date(nowMs));
    const lookup = {};
    for (const p of parts) {
      if (p.type === "year" || p.type === "month" || p.type === "day") {
        lookup[p.type] = p.value;
      }
    }
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
  }

  // Milliseconds until the next midnight in America/New_York from nowMs
  #getMsUntilNextEstMidnight(nowMs) {
    const estNow = new Date(
      new Date(nowMs).toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const nextMidnightEst = new Date(estNow);
    nextMidnightEst.setHours(24, 0, 0, 0);
    return nextMidnightEst.getTime() - estNow.getTime();
  }

  #refillTokens(now) {
    const { rps, perSecondCapacity } = RateLimiter;
    const { lastRefill, tokens } = this.state;

    const elapsedMs = now - lastRefill;
    if (elapsedMs <= 0) return;

    // Number of tokens to add based on elapsed time and target rate
    const tokensToAdd = Math.floor((elapsedMs / 1000) * rps);
    if (tokensToAdd <= 0) return;

    const newTokenCount = Math.min(perSecondCapacity, tokens + tokensToAdd);
    this.state.tokens = newTokenCount;
    this.state.lastRefill = lastRefill + Math.floor((tokensToAdd / rps) * 1000);
  }

  #resetDailyWindowIfNeeded(nowMs) {
    const currentKey = this.#getEstDayKey(nowMs);
    if (!this.state.dayKey || this.state.dayKey !== currentKey) {
      this.state.dayKey = currentKey;
      this.state.dayCount = 0;
    }
  }

  /**
   * Core API the Worker calls to check & update rate limits.
   * Returns:
   *   {
   *     allowed: boolean,
   *     retryAfterMs: number,    // 0 if allowed
   *     dailyRemaining: number,  // remaining requests in 24h window
   *     dailyResetInMs: number   // ms until daily window resets
   *   }
   */
  async getLimitStatus() {
    const now = Date.now();
    await this.#loadState();

    // Handle daily window
    this.#resetDailyWindowIfNeeded(now);

    const { dayCount } = this.state;
    const dailyRemaining = Math.max(0, RateLimiter.dayLimit - dayCount);
    const dailyResetInMs = Math.max(0, this.#getMsUntilNextEstMidnight(now));

    // If we've hit the daily limit, block regardless of per-second tokens
    if (dailyRemaining <= 0) {
      return {
        allowed: false,
        retryAfterMs: dailyResetInMs,
        dailyRemaining: 0,
        dailyResetInMs
      };
    }

    // Refill per-second tokens
    this.#refillTokens(now);
    const { tokens } = this.state;

    if (tokens <= 0) {
      // Compute approximate time until next token
      const msPerRequest = 1000 / RateLimiter.rps;
      const retryAfterMs = Math.ceil(msPerRequest);

      return {
        allowed: false,
        retryAfterMs,
        dailyRemaining,
        dailyResetInMs
      };
    }

    // Allow request: consume one token and bump daily count
    this.state.tokens -= 1;
    this.state.dayCount += 1;
    await this.#saveState();

    return {
      allowed: true,
      retryAfterMs: 0,
      dailyRemaining: Math.max(0, RateLimiter.dayLimit - this.state.dayCount),
      dailyResetInMs
    };
  }
}

// Worker that uses the RateLimiter Durable Object to protect an upstream resource.
// The frontend should call ONLY this Worker; the Worker then calls your backend,
// and the backend calls Gemini. Gemini keys and backend origin stay hidden
// from the browser.
export default {
  /**
   * @param {Request} request
   * @param {Env & { RATE_LIMITER: DurableObjectNamespace<RateLimiter> }} env
   */
  async fetch(request, env, ctx) {
    // Decide what you want to rate-limit *by*:
    // For now, use per-IP like the Cloudflare docs example:
    // https://developers.cloudflare.com/durable-objects/examples/build-a-rate-limiter/
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip === null) {
      return new Response("Could not determine client IP", { status: 400 });
    }

    // Get per-IP Durable Object stub
    const stub = env.RATE_LIMITER.getByName(ip);

    let status;
    try {
      status = await stub.getLimitStatus();
    } catch (err) {
      // Fail-closed for safety: if limiter is unavailable, do NOT call upstream.
      return new Response("Could not connect to rate limiter", { status: 502 });
    }

    if (!status.allowed) {
      // Log rate limit hit: who, when, which route, and why
      const url = new URL(request.url);
      console.log(
        JSON.stringify({
          type: "rate_limit_exceeded",
          ip,
          path: url.pathname,
          timestamp: new Date().toISOString(),
          dailyRemaining: status.dailyRemaining,
          retryAfterMs: status.retryAfterMs
        })
      );

      const headers = new Headers({
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": Math.ceil(status.retryAfterMs / 1000).toString(),
        "X-RateLimit-Remaining-Day": String(status.dailyRemaining),
        "X-RateLimit-Reset-Day": String(Math.floor(status.dailyResetInMs / 1000))
      });
      return new Response("Rate limit exceeded", { status: 429, headers });
    }

    // At this point the request is allowed.
    // Forward the request to your backend, which then calls Gemini.
    // Backend origin is configured via BACKEND_ORIGIN in wrangler.toml.
    const backendOrigin = env.BACKEND_ORIGIN;
    if (!backendOrigin) {
      return new Response("Backend origin not configured", { status: 500 });
    }

    const incomingUrl = new URL(request.url);
    const backendBase = new URL(backendOrigin);

    const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, backendBase);

    // Preserve method, headers, and body when proxying to backend.
    const upstreamRequest = new Request(upstreamUrl.toString(), request);

    const upstreamResponse = await fetch(upstreamRequest);

    // Optionally, you could add rate-limit headers to the response back to the client.
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("X-RateLimit-Remaining-Day", String(status.dailyRemaining));
    responseHeaders.set(
      "X-RateLimit-Reset-Day",
      String(Math.floor(status.dailyResetInMs / 1000))
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  }
}


