# rcp-rabbitmq-mcp

Standalone RabbitMQ MCP server. Exposes **publish / consume / inspect / manage**
tools over the [Model Context Protocol](https://modelcontextprotocol.io) (stdio),
so it can be plugged into any MCP client (OpenCode, Claude Desktop, …). Built on
the official `@modelcontextprotocol/sdk` + [`amqplib`](https://www.npmjs.com/package/amqplib).

This is a **pure MCP server, not an agent** — no system prompt, no agent loop.
It just exposes RabbitMQ operations as tools and returns JSON.

## Tools

| Tool | Kind | What it does |
|---|---|---|
| `rabbitmq_publish` | write | Publish a message to an exchange, or directly to a queue (`exchange=""`) |
| `rabbitmq_consume` | write | Read up to N messages; `remove=false` peeks (requeues), `remove=true` acks/removes |
| `rabbitmq_list_queues` | read-only | List all queues in the vhost (message/consumer counts) via the management HTTP API |
| `rabbitmq_check_queue` | read-only | Inspect one queue (exists + counts) via AMQP — no management plugin needed |
| `rabbitmq_declare_queue` | write | Create / re-declare a queue (idempotent if options match) |
| `rabbitmq_delete_queue` | write · destructive | Delete a queue (removes it + its messages, unless `ifEmpty`/`ifUnused`) |
| `rabbitmq_bind_queue` | write | Bind a queue to an exchange with a routing key |
| `rabbitmq_declare_exchange` | write | Create / re-declare an exchange (`direct` / `fanout` / `topic` / `headers`) |

Tool descriptions are kept token-efficient so the tool definitions stay cheap in
the model's context (~1.1k tokens for all 8).

## Requirements

- **Node.js** ≥ 18 (ESM)
- A **RabbitMQ broker**. For `rabbitmq_list_queues` the [management plugin](https://www.rabbitmq.com/management.html) must be enabled.

Quick local broker with the management plugin:

```bash
docker run -d --rm -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

## Quick start

```bash
git clone https://github.com/rcpsolutions-net/rcp-rabbitmq-mcp.git
cd rcp-rabbitmq-mcp
npm install
npm run build        # compiles TypeScript -> dist/
```

Run the server (speaks MCP over stdio):

```bash
RABBITMQ_URL=amqp://guest:guest@localhost:5672/ npm start
```

## Plug into an MCP client

Add it to your MCP client config (OpenCode, Claude Desktop, …):

```json
{
  "mcpServers": {
    "rabbitmq": {
      "command": "node",
      "args": ["/abs/path/to/rcp-rabbitmq-mcp/dist/index.js"],
      "env": { "RABBITMQ_URL": "amqp://guest:guest@localhost:5672/" }
    }
  }
}
```

All logging goes to **stderr** so stdout stays clean for the MCP protocol.

### Example tool calls

Publish directly to a queue (default exchange):

```json
{ "name": "rabbitmq_publish",
  "arguments": { "exchange": "", "routingKey": "orders", "message": "{\"id\":1}" } }
```

Consume (ack) the next 5 messages in order:

```json
{ "name": "rabbitmq_consume",
  "arguments": { "queue": "orders", "count": 5, "remove": true } }
```

## Environment variables

| Var | Required | Description |
|---|---|---|
| `RABBITMQ_URL` | **yes** | AMQP connection string, e.g. `amqp://guest:guest@localhost:5672/` |
| `RABBITMQ_MANAGEMENT_URL` | no | Override for the management HTTP API (default: derived from `RABBITMQ_URL` host on port `15672`). Only used by `rabbitmq_list_queues`. |

## Development

```bash
npm run dev    # run from source via tsx (MCP over stdio)
npm run lint   # typecheck without emitting
npm test       # (no test harness yet) — use the smoke test below
```

**Smoke test** — end-to-end against a live broker (start one first, e.g. the
`docker run` above). Drives the compiled server over stdio via the MCP client SDK:

```bash
RABBITMQ_URL=amqp://guest:guest@localhost:5672/ node smoke-test.mjs
```

It declares a queue, publishes/consumes messages, checks counts, tests the
peek-vs-remove behavior (including the requeue-to-head warning), exercises the
management-API listing, exchange declaration + binding, and a destructive delete.

## Gotchas

- **`rabbitmq_list_queues` needs the management plugin** enabled
  (`rabbitmq-plugins enable rabbitmq_management`). Every other tool uses the AMQP
  protocol directly and does not.
- **`rabbitmq_consume` requeues to the HEAD of the queue.** So peeking with
  `count>1` re-reads the same message repeatedly — the tool returns a `warning`
  in that case. Peek with `count=1`, or use `remove=true` to process messages in
  order.
- **Publishing directly to a queue** = publish to the default exchange (`""`)
  with the queue name as the routing key.
- One shared AMQP connection, but a **fresh channel per tool call** (keeps the
  server robust against channel-level errors without leaking state between calls).

## License

© RCP Solutions, LLC. All rights reserved.
