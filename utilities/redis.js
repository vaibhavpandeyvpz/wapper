const Redis = require("ioredis");
const { v4: uuid } = require("uuid");

const defaultTimeout = 30 * 1000; // 30 seconds

const client = new Redis(process.env.REDIS_URL);
const subscriber = client.duplicate();

async function sendAndReceive(instance, cmd, args = {}) {
  const { publish, subscribe } = await setUpPubSub(instance, "server");
  const id = uuid();
  let reply;
  subscribe((message) => {
    if (message.id === id && message.cmd === cmd) {
      reply = message;
    }
  });
  await publish(id, cmd, args);
  const result = await Promise.race([
    waitForCondition(() => !!reply).then(() => reply),
    waitForTimeout(defaultTimeout).then(() => ({ args: { success: false } })),
  ]);
  return result.args;
}

async function setUpPubSub(instance, origin) {
  return new Promise((resolve, reject) => {
    subscriber.subscribe(instance, (err) => {
      if (err) {
        reject();
        return;
      }

      resolve({
        subscribe(callback) {
          subscriber.on("message", (_, message) => {
            if (_ !== instance) {
              return;
            }

            const json = JSON.parse(message);
            if (json?.origin !== origin /* skip own message */) {
              callback(json);
            }
          });
        },
        async publish(id, cmd, args) {
          return client.publish(
            instance,
            JSON.stringify({ id, cmd, args, origin })
          );
        },
      });
    });
  });
}

async function waitForCondition(condition, poll = 100) {
  return new Promise((resolve) => {
    let timer;
    timer = setInterval(() => {
      if (condition()) {
        clearInterval(timer);
        resolve();
      }
    }, poll);
  });
}

async function waitForTimeout(timeout = defaultTimeout, poll = 100) {
  let elapsed = 0;
  return waitForCondition(() => (elapsed += poll) >= defaultTimeout, poll);
}

module.exports = {
  client,
  sendAndReceive,
  setUpPubSub,
};
