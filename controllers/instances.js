const Joi = require("joi");
const Router = require("@koa/router");

const {
  createInstance,
  findInstance,
  deleteInstance,
  updateWebhookUrl,
  findWebhookUrls,
} = require("../utilities/mongo");
const { runOrFail, ...pm2 } = require("../utilities/pm2");
const { createInstanceToken } = require("../utilities/security");

const router = new Router({ prefix: "/instances" });

router.post("/", async function (ctx) {
  const schema = Joi.object({
    webhook: Joi.string().uri().required(),
  });
  const { error, value } = schema.validate(ctx.request.body || {});
  if (error) {
    ctx.throw(422, error);
  }

  const id = await createInstance();
  await updateWebhookUrl(id, "system", value.webhook);
  await runOrFail(() => pm2.start(id).then(() => pm2.dump()));
  const token = createInstanceToken(id, 24 * 365); // 1 year expiry
  ctx.body = { success: true, id, token };
});

router.get("/:id", async function (ctx) {
  const instance = await findInstance(ctx.params.id);
  if (!instance) {
    ctx.throw(404, `Unable to find instance by ID ${ctx.params.id}.`);
  }

  const { _id, ...others } = instance;
  ctx.body = { success: true, instance: others };
});

router.get("/:id/token", async function (ctx) {
  const instance = await findInstance(ctx.params.id);
  if (!instance) {
    ctx.throw(404, `Unable to find instance by ID ${ctx.params.id}.`);
  }

  const token = createInstanceToken(instance.instanceId, 24 * 365); // 1 year expiry
  ctx.body = { success: true, token };
});

router.del("/:id", async function (ctx) {
  const instance = await findInstance(ctx.params.id);
  if (!instance) {
    ctx.throw(404, `Unable to find instance by ID ${ctx.params.id}.`);
  }

  await runOrFail(() =>
    pm2
      .stop(instance.instanceId)
      .then(() => pm2.remove(instance.instanceId))
      .then(() => deleteInstance(instance.instanceId))
      .then(() => pm2.dump().catch(() => {}))
  );
  ctx.body = { success: true };
});

router.get("/:id/webhooks", async function (ctx) {
  const instance = await findInstance(ctx.params.id);
  if (!instance) {
    ctx.throw(404, `Unable to find instance by ID ${ctx.params.id}.`);
  }

  const urls = await findWebhookUrls(instance.instanceId);
  ctx.body = { success: true, urls };
});

router.put("/:id/webhooks", async function (ctx) {
  const schema = Joi.object({
    type: Joi.string().valid("user", "system").required(),
    url: Joi.string().uri().optional(),
  });
  const { error, value } = schema.validate(ctx.request.body || {});
  if (error) {
    ctx.throw(422, error);
  }

  const instance = await findInstance(ctx.params.id);
  if (!instance) {
    ctx.throw(404, `Unable to find instance by ID ${ctx.params.id}.`);
  }

  await updateWebhookUrl(instance.instanceId, value.type, value.url || null);
  ctx.body = { success: true };
});

router.put("/:id/:action", async function (ctx) {
  const instance = await findInstance(ctx.params.id);
  if (!instance) {
    ctx.throw(404, `Unable to find instance by ID ${ctx.params.id}.`);
  }

  switch (ctx.params.action) {
    case "restart":
      await runOrFail(() => pm2.restart(instance.instanceId));
      break;
    case "start":
      await runOrFail(() => pm2.start(instance.instanceId));
      break;
    case "stop":
      await runOrFail(() => pm2.stop(instance.instanceId));
      break;
    default:
      ctx.throw(422, "invalid 'action' passed");
      break;
  }

  ctx.body = { success: true };
});

module.exports = router;
