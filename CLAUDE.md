# rcp-rabbitmq-mcp

Standalone RabbitMQ MCP server. Exposes publish / consume / inspect / manage
tools over the MCP protocol (stdio), so it can be plugged into any MCP client
(OpenCode, Claude Desktop, …). Built on the official `@modelcontextprotocol/sdk`
+ `amqplib`.

This is a **pure MCP server**, not an agent — no system prompt, no agent loop.
It's a sibling of `rcp-gs-agent` (which is a Claude Agent SDK *agent* using the
in-process `createSdkMcpServer`). Don't conflate the two.

## Layout

- `src/index.ts` — entry point (stdio MCP server, env config).
- `src/rabbitmq.ts` — pure registry: imports the 8 tool modules and calls each
  `registerRabbitMq*()`; zero logic.
- `src/tools/<tool>.ts` — one file per tool (filename = tool name, kebab-case).
  Each exports `registerRabbitMq<Tool>(server)` which calls
  `server.registerTool('rabbitmq_<tool>', ...)`. Tool-private helpers stay in
  the tool's own file (e.g. the management-API fetch lives in
  `rabbitmq-list-queues.ts`).
- `src/connection.ts` — shared AMQP connection: exports `withChannel()` (fresh
  channel per tool call) and `rabbitUrl()`.
- `src/results.ts` — shared `jsonResult()` / `errorResult()` helpers.

## Coding rules

- TypeScript strict mode, ESM (`"type": "module"`), `NodeNext` module resolution.
  Relative imports MUST use the `.js` extension (e.g. `import ... from './rabbitmq.js'`).
- Tools live in `src/tools/<tool>.ts` (one file per tool) and are registered via
  `server.registerTool(...)`; `src/rabbitmq.ts` is a pure registry that calls
  each module's `registerRabbitMq*()`.
- All handlers return a `CallToolResult` through the shared `jsonResult()` /
  `errorResult()` helpers (`src/results.ts`) — keep the JSON shape predictable so
  the client can parse it.
- Read-only tools set `annotations: { readOnlyHint: true, openWorldHint: true }`.
- Destructive tools (delete) set `annotations: { destructiveHint: true, ... }`.
- One shared AMQP connection, but a **fresh channel per tool call** (see
  `withChannel` in `src/connection.ts`). Don't cache channels across calls.

## Tools

| Tool | Kind | Notes |
|---|---|---|
| `rabbitmq_publish` | write | publish to an exchange, or a queue via the default exchange (`exchange=""`) |
| `rabbitmq_consume` | write | read up to N messages; `remove=false` peeks (requeues), `remove=true` acks |
| `rabbitmq_list_queues` | read-only | lists all queues via the **management HTTP API** (needs the mgmt plugin) |
| `rabbitmq_check_queue` | read-only | inspect one queue via AMQP `checkQueue` (no mgmt plugin needed) |
| `rabbitmq_declare_queue` | write | create/re-declare a queue |
| `rabbitmq_delete_queue` | write (destructive) | delete a queue |
| `rabbitmq_bind_queue` | write | bind a queue to an exchange |
| `rabbitmq_declare_exchange` | write | create/re-declare an exchange |

## Common commands

- `npm run build` — compile to `dist/`
- `npm run lint` — typecheck without emitting
- `npm run dev` — run the server from source via `tsx` (talks MCP over stdio)
- `npm start` — run the compiled server (`node dist/index.js`)
- `RABBITMQ_URL=... node smoke-test.mjs` — end-to-end smoke test against a live
  broker. Start one first, e.g.
  `docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management`

## Environment

- `RABBITMQ_URL` — **required.** AMQP connection string, e.g.
  `amqp://guest:guest@localhost:5672/`
- `RABBITMQ_MANAGEMENT_URL` — optional. Override for the management HTTP API
  (default: derived from `RABBITMQ_URL` host on port `15672`). Only needed for
  `rabbitmq_list_queues`.

## Gotchas

- `rabbitmq_list_queues` needs the RabbitMQ **management plugin** enabled
  (`rabbitmq-plugins enable rabbitmq_management`). The other tools use the AMQP
  protocol directly and don't.
- `rabbitmq_consume` uses `channel.get()` in a loop (bounded, stateless), not a
  persistent consumer. `remove=true` acks (removes) messages in order;
  `remove=false` requeues them (peek). **RabbitMQ requeues to the HEAD of the
  queue**, so peeking with `count>1` re-reads the same message repeatedly — the
  tool returns a `warning` in that case. For peeking, use `count=1`.
- Publishing directly to a queue = publish to the default exchange (`""`) with
  the queue name as the routing key.
