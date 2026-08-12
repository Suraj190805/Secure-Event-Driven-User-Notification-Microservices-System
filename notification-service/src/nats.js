const { connect, StringCodec, AckPolicy, DeliverPolicy } = require("nats");

const sc = StringCodec();
let nc = null;

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2_000;

/**
 * Wait for the USERS stream to be created by the User Service.
 */
async function waitForStream(jsm) {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await jsm.streams.info("USERS");
      return;
    } catch {
      console.log(
        `[NATS] USERS stream not found, retrying (${i}/${MAX_RETRIES})...`
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error("USERS stream was not created in time");
}

/**
 * Connect to NATS and subscribe to the USERS stream with a durable consumer.
 * @param {Function} onMessage  callback(subject, data) invoked for each event
 */
async function init(onMessage) {
  const url = process.env.NATS_URL || "nats://localhost:4222";
  console.log(`[NATS] Connecting to ${url}...`);

  nc = await connect({
    servers: url,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2_000,
  });

  console.log("[NATS] Connected");

  const jsm = await nc.jetstreamManager();
  const js = nc.jetstream();

  // Wait for the User Service to create the USERS stream
  await waitForStream(jsm);

  // Ensure durable consumer exists (idempotent)
  try {
    await jsm.consumers.info("USERS", "notification-service");
  } catch {
    await jsm.consumers.add("USERS", {
      durable_name: "notification-service",
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      filter_subject: "user.>",
    });
    console.log("[NATS] Created durable consumer: notification-service");
  }

  const consumer = await js.consumers.get("USERS", "notification-service");
  const sub = await consumer.consume();

  (async () => {
    for await (const msg of sub) {
      try {
        const data = JSON.parse(sc.decode(msg.data));
        await onMessage(msg.subject, data);
        msg.ack();
      } catch (err) {
        console.error("[NATS] Failed to process message:", err.message);
        // Negative-ack with delay so the message is retried
        msg.nak(5_000);
      }
    }
  })();
}

/**
 * Graceful drain.
 */
async function drain() {
  if (nc) {
    await nc.drain();
    console.log("[NATS] Drained");
  }
}

module.exports = { init, drain };
