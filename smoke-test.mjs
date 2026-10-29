// End-to-end smoke test: drives the compiled MCP server over stdio using the
// MCP client SDK, against a live RabbitMQ broker.
//
// Run:  RABBITMQ_URL=amqp://guest:guest@localhost:5672/ node smoke-test.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['dist/index.js'],
  env: { ...process.env, RABBITMQ_URL },
  stderr: 'pipe',
});

const client = new Client({ name: 'smoke-test', version: '0.0.1' });
await client.connect(transport);

let failures = 0;
function check(label, cond, extra = '') {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
}

async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? '';
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { isError: res.isError, parsed };
}

// 1. List tools
const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
console.log('\n--- tools ---');
console.log(names.join(', '));
check('8 tools registered', names.length === 8, `(${names.length})`);

// 2. Declare a queue
let r = await call('rabbitmq_declare_queue', { queue: 'smoke-test', durable: true });
check('declare_queue', !r.isError && r.parsed.queue === 'smoke-test', JSON.stringify(r.parsed));

// 3. Publish 3 messages
for (let i = 1; i <= 3; i++) {
  r = await call('rabbitmq_publish', { exchange: '', routingKey: 'smoke-test', message: `msg-${i}` });
  check(`publish msg-${i}`, !r.isError && r.parsed.published === true);
}

// 4. Check queue -> 3 messages
r = await call('rabbitmq_check_queue', { queue: 'smoke-test' });
check('check_queue shows 3', !r.isError && r.parsed.messageCount === 3, JSON.stringify(r.parsed));

// 5. Consume peek count=1 (recommended) -> reads 1 (msg-1), stays in queue
r = await call('rabbitmq_consume', { queue: 'smoke-test', count: 1, remove: false });
check(
  'consume peek(1) reads msg-1',
  !r.isError && r.parsed.count === 1 && r.parsed.messages[0].body === 'msg-1',
  JSON.stringify(r.parsed.messages?.map((m) => m.body))
);

// 6. Check queue -> still 3 (peek requeued)
r = await call('rabbitmq_check_queue', { queue: 'smoke-test' });
check('check_queue still 3 after peek', !r.isError && r.parsed.messageCount === 3, JSON.stringify(r.parsed));

// 6b. Peek count>1 -> warning present (requeue-to-head caveat)
r = await call('rabbitmq_consume', { queue: 'smoke-test', count: 2, remove: false });
check(
  'peek count>1 warns',
  !r.isError && typeof r.parsed.warning === 'string',
  JSON.stringify(r.parsed.messages?.map((m) => m.body))
);

// 7. Consume remove (remove=true) -> reads 3 and removes
r = await call('rabbitmq_consume', { queue: 'smoke-test', count: 3, remove: true });
check('consume remove reads 3', !r.isError && r.parsed.count === 3);

// 8. Check queue -> 0
r = await call('rabbitmq_check_queue', { queue: 'smoke-test' });
check('check_queue 0 after remove', !r.isError && r.parsed.messageCount === 0, JSON.stringify(r.parsed));

// 9. List queues (management API)
r = await call('rabbitmq_list_queues', { name: 'smoke-test' });
check('list_queues finds smoke-test', !r.isError && r.parsed.count === 1 && r.parsed.queues[0].name === 'smoke-test', JSON.stringify(r.parsed));

// 10. Declare exchange
r = await call('rabbitmq_declare_exchange', { exchange: 'smoke-ex', type: 'direct' });
check('declare_exchange', !r.isError && r.parsed.exchange === 'smoke-ex' && r.parsed.type === 'direct', JSON.stringify(r.parsed));

// 11. Bind queue to exchange
r = await call('rabbitmq_bind_queue', { queue: 'smoke-test', exchange: 'smoke-ex', routingKey: 'rk1' });
check('bind_queue', !r.isError && r.parsed.bound === true, JSON.stringify(r.parsed));

// 12. Publish via exchange -> routed to bound queue
r = await call('rabbitmq_publish', { exchange: 'smoke-ex', routingKey: 'rk1', message: 'via-exchange' });
check('publish via exchange', !r.isError && r.parsed.published === true);
r = await call('rabbitmq_check_queue', { queue: 'smoke-test' });
check('message routed to bound queue', !r.isError && r.parsed.messageCount === 1, JSON.stringify(r.parsed));

// 13. Delete queue (destructive)
r = await call('rabbitmq_delete_queue', { queue: 'smoke-test' });
check('delete_queue', !r.isError && r.parsed.deleted === true, JSON.stringify(r.parsed));

// 14. check_queue on missing queue -> graceful error
r = await call('rabbitmq_check_queue', { queue: 'smoke-test' });
check('check_queue missing -> isError', r.isError === true, JSON.stringify(r.parsed));

// 15. Clean up exchange
await call('rabbitmq_delete_queue', { queue: 'smoke-test' }); // no-op, already gone

await client.close();

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
