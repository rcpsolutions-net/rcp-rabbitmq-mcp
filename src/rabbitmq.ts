import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRabbitMqPublish } from './tools/rabbitmq-publish.js';
import { registerRabbitMqConsume } from './tools/rabbitmq-consume.js';
import { registerRabbitMqListQueues } from './tools/rabbitmq-list-queues.js';
import { registerRabbitMqCheckQueue } from './tools/rabbitmq-check-queue.js';
import { registerRabbitMqDeclareQueue } from './tools/rabbitmq-declare-queue.js';
import { registerRabbitMqDeleteQueue } from './tools/rabbitmq-delete-queue.js';
import { registerRabbitMqBindQueue } from './tools/rabbitmq-bind-queue.js';
import { registerRabbitMqDeclareExchange } from './tools/rabbitmq-declare-exchange.js';

/* ------------------------------------------------------------------ *
 * Tool registration — one module per tool in ./tools/, pure registry.
 * ------------------------------------------------------------------ */

export function registerRabbitMqTools(server: McpServer): void {
  registerRabbitMqPublish(server);
  registerRabbitMqConsume(server);
  registerRabbitMqListQueues(server);
  registerRabbitMqCheckQueue(server);
  registerRabbitMqDeclareQueue(server);
  registerRabbitMqDeleteQueue(server);
  registerRabbitMqBindQueue(server);
  registerRabbitMqDeclareExchange(server);
}
