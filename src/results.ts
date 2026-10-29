import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/* ------------------------------------------------------------------ *
 * Result helpers — keep the JSON shape predictable so the client can parse it.
 * ------------------------------------------------------------------ */

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}
