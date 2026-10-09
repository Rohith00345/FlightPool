/**
 * FlightPool Demo Mode Utilities
 *
 * STRICT FAIL-CLOSED CONVENTION:
 * Demo mode is ON ONLY when the corresponding environment variable is exactly the string "true".
 * Any other value (undefined, null, empty string, "false", "0", etc.) evaluates strictly to OFF (false).
 */

/**
 * Evaluates whether demo mode is active on the server.
 * Strict fail-closed: true ONLY when process.env.DEMO_MODE === "true".
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * Evaluates whether demo mode is active on the client.
 * Strict fail-closed: true ONLY when process.env.NEXT_PUBLIC_DEMO_MODE === "true".
 *
 * NOTE: In Next.js, process.env.NEXT_PUBLIC_* variables are replaced at build time
 * by Turbopack / Webpack through static AST analysis. If NEXT_PUBLIC_DEMO_MODE is not
 * set to "true" at build time, it will evaluate to false in client components.
 */
export function isClientDemoMode(): boolean {
  if (typeof window !== "undefined") {
    if ((window as unknown as { __FORCE_DEMO_MODE__?: string }).__FORCE_DEMO_MODE__ !== undefined) {
      return (window as unknown as { __FORCE_DEMO_MODE__?: string }).__FORCE_DEMO_MODE__ === "true";
    }
    const htmlAttr = document.documentElement.getAttribute("data-demo-mode");
    if (htmlAttr !== null) {
      return htmlAttr === "true";
    }
    return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  }
  return isDemoMode() || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
