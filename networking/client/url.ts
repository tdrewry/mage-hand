// networking/client/url.ts

/**
 * Accepts ws:// and wss:// directly.
 * Convenience: upgrades http:// -> ws:// and https:// -> wss://
 */
export function normalizeWsUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) return trimmed;
  if (trimmed.startsWith("http://")) return "ws://" + trimmed.slice("http://".length);
  if (trimmed.startsWith("https://")) return "wss://" + trimmed.slice("https://".length);
  // If user entered host:port, assume ws://
  if (/^[^/]+:\d+$/.test(trimmed)) return `ws://${trimmed}`;
  return trimmed;
}
