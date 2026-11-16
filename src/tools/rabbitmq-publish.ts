import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withConfirmChannel } from '../connection.js';
import { jsonResult, errorResult } from '../results.js';

export function registerRabbitMqPublish(server: McpServer): void {
  server.registerTool(
    'rabbitmq_publish',
    {
      title: 'Publish message',
      description:
        'Publish a message to an exchange, or a queue (exchange=""). Fails, with the message not delivered, when no queue receives it (e.g. routingKey is not an existing queue\'s exact name).',
      inputSchema: {
        exchange: z
          .string()
          .default('')
          .describe(
            'Target exchange; "" = default.'
          ),
        routingKey: z
          .string()
          .describe('Routing key; = the queue\'s exact name when exchange="".'),
        message: z.string().describe('Body (UTF-8).'),
        contentType: z.string().default('text/plain').describe('Content-Type header.'),
        persistent: z
          .boolean()
          .default(false)
          .describe('Survive broker restarts.'),
        headers: z
          .record(z.string(), z.string())
          .optional()
          .describe('Extra headers (string→string).'),
      },
      annotations: { openWorldHint: true },
    },
    async ({ exchange, routingKey, message, contentType, persistent, headers }) => {
      try {
        // Mandatory + a confirm channel: the broker returns a message no queue took, before it confirms, so a publish
        // that went nowhere (a routing key that names no queue) is an error here, not `published: true`.
        const returned = await withConfirmChannel(async (ch) => {
          let bounced = false;
          let serverError: Error | undefined;
          ch.on('return', () => {
            bounced = true;
          });
          // A missing exchange closes the channel with the broker's reason (404 NOT_FOUND); keep it, the pending publish
          // otherwise only says "channel closed".
          ch.on('error', (e: Error) => {
            serverError = e;
          });
          const content = Buffer.from(message, 'utf8');
          await new Promise<void>((resolve, reject) => {
            ch.publish(exchange, routingKey, content, { contentType, persistent, headers, mandatory: true }, (err) =>
              // The channel's own error event may land a moment after the publish's callback.
              err ? setImmediate(() => reject(serverError ?? err)) : resolve()
            );
          });
          return bounced;
        });
        if (returned) {
          return errorResult(
            new Error(
              `Not delivered: no queue received the message (exchange ${JSON.stringify(exchange)}, routingKey ${JSON.stringify(routingKey)}). ` +
                (exchange === ''
                  ? 'On the default exchange the routing key must be the exact name of an existing queue.'
                  : 'Nothing is bound to that exchange for this routing key.')
            )
          );
        }
        return jsonResult({
          published: true,
          exchange,
          routingKey,
          bytes: Buffer.byteLength(message, 'utf8'),
        });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
