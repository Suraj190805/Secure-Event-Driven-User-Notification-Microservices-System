const { connect, StringCodec } = require("nats");

const sc = StringCodec();
let nc = null;
let js = null;

/**
 * Connect to NATS and ensure the USERS JetStream stream exists.
 */
async function init() {
  const url = process.env.NATS_URL || "nats://localhost:4222";
  console.log(`[NATS] Connecting to ${url}...`);

  nc = await connect({
    servers: url,
    reconnect: true,
    maxReconnectAttempts: -1, // unlimited
    reconnectTimeWait: 2_000,
  });

  console.log("[NATS] Connected");

  const jsm = await nc.jetstreamManager();
  js = nc.jetstream();

  // Ensure the USERS stream exists (idempotent)
  try {
    await jsm.streams.info("USERS");
  } catch {
    await jsm.streams.add({
      name: "USERS",
      subjects: ["user.>"],
    });
    console.log("[NATS] Created USERS stream");
  }
}

/**
 * Publish a message to a JetStream subject.
 */
async function publish(subject, data) {
  if (!js) throw new Error("NATS not initialized");
  const payload = sc.encode(JSON.stringify(data));
  const ack = await js.publish(subject, payload);
  console.log(`[NATS] Published to ${subject} (seq: ${ack.seq})`);
  return ack;
}

/**
 * Graceful drain on shutdown.
 */
async function drain() {
  if (nc) {
    await nc.drain();
    console.log("[NATS] Drained");
  }
}

module.exports = { init, publish, drain };
