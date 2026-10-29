import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withChannel } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

export function registerRabbitMqConsume(server: McpServer): void {
  server.registerTool(
    'rabbitmq_consume',
    {
      title: 'Read messages',
      description:
        'Read from a queue. remove=true acks+removes (process N in order); false peeks/requeues. Requeue→HEAD: peek with count=1, else count>1 re-reads the same message.',
      inputSchema: {
        queue: z.string().describe('Queue to read.'),
        count: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(1)
          .describe('Max messages.'),
        remove: z
          .boolean()
          .default(false)
          .describe('true=ack+remove; false=requeue (peek).'),
      },
      annotations: { openWorldHint: true },
    },
    async ({ queue, count, remove }) => {
      try {
        const messages = await withChannel(async (ch) => {
          const out: Array<Record<string, unknown>> = [];
          for (let i = 0; i < count; i++) {
            const msg = await ch.get(queue, { noAck: false });
            if (msg === false) break; // queue empty
            if (remove) ch.ack(msg);
            else ch.nack(msg, false, true); // requeue (goes back to the head)
            out.push({
              body: msg.content.toString('utf8'),
              redelivered: msg.fields.redelivered,
              exchange: msg.fields.exchange,
              routingKey: msg.fields.routingKey,
              contentType: msg.properties.contentType ?? null,
            });
          }
          return out;
        });
        const result: Record<string, unknown> = {
          queue,
          remove,
          count: messages.length,
          messages,
        };
        if (!remove && count > 1) {
          result.warning =
            'Peek with count>1: RabbitMQ requeues to the head of the queue, so the same message may be returned repeatedly. Use count=1 to peek the next message, or remove=true to process messages in order.';
        }
        return jsonResult(result);
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
