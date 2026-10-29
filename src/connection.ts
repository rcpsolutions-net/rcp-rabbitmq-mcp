import * as amqp from 'amqplib';

/* ------------------------------------------------------------------ *
 * Connection management
 *
 * One shared AMQP connection (lazily created, reused across calls), but a
 * FRESH channel per tool call. Channels are cheap; a per-call channel keeps
 * the server robust against channel-level errors (e.g. PRECONDITION_FAILED
 * from a missing queue) without leaking state between calls.
 * ------------------------------------------------------------------ */

let channelModel: amqp.ChannelModel | null = null;
let connecting: Promise<amqp.ChannelModel> | null = null;

export function rabbitUrl(): string {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error(
      'RABBITMQ_URL is not set. Example: amqp://guest:guest@localhost:5672/'
    );
  }
  return url;
}

async function getChannelModel(): Promise<amqp.ChannelModel> {
  if (channelModel) return channelModel;
  if (!connecting) {
    connecting = amqp
      .connect(rabbitUrl())
      .then((model) => {
        channelModel = model;
        model.on('close', () => {
          channelModel = null;
          connecting = null;
        });
        model.on('error', (err) => {
          // Connection-level errors; the 'close' handler resets state so the
          // next call reconnects cleanly.
          console.error('[rabbitmq] connection error:', err.message);
        });
        return model;
      })
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  return connecting;
}

/** Run `fn` on a fresh channel, closing it when done. */
export async function withChannel<T>(fn: (ch: amqp.Channel) => Promise<T>): Promise<T> {
  const model = await getChannelModel();
  const ch = await model.createChannel();
  try {
    return await fn(ch);
  } finally {
    await ch.close().catch(() => undefined);
  }
}
