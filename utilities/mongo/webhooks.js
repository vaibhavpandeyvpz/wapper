const { connect } = require("./common");

async function findWebhookUrl(instanceId, type) {
  const db = await connect();
  const webhooks = db.collection("webhooks");
  const webhook = await webhooks.findOne({ instanceId, type });
  return webhook?.url || null;
}

async function findWebhookUrls(instanceId) {
  const client = await findWebhookUrl(instanceId, "client");
  const system = await findWebhookUrl(instanceId, "system");
  return { client, system };
}

async function updateWebhookUrl(instanceId, type, url) {
  const db = await connect();
  const webhooks = db.collection("webhooks");
  await webhooks.updateOne(
    { instanceId, type },
    {
      $set: {
        url: url || null,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        instanceId,
        type,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

module.exports = {
  findWebhookUrl,
  findWebhookUrls,
  updateWebhookUrl,
};
