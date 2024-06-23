const Joi = require("joi");
const multer = require("@koa/multer");
const Router = require("@koa/router");
const rateLimit = require("koa-ratelimit");

const { client, sendAndReceive } = require("../../utilities/redis");
const { instanceMiddleware } = require("../../utilities/security");
const { saveBufferAs, newFilePath } = require("../../utilities/uploads");

const router = new Router();
const upload = multer();

const fileSize = 5 * 1024 * 1024; // 5MB

router.use(
  rateLimit({
    db: client,
    errorMessage: "You are being rate-limited.",
    max: 3600, // per hour
  })
);

router.use(instanceMiddleware());

router.get("/chats", async function (ctx) {
  const { success, chats } = await sendAndReceive(ctx.state.user.sub, "chats");
  if (!success) {
    ctx.throw(
      500,
      `Could not retrieve chats from instance ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, chats };
});

router.get("/chats/:id", async function (ctx) {
  const { success, chat } = await sendAndReceive(
    ctx.state.user.sub,
    "chatById",
    { chat: ctx.params.id }
  );
  if (!success) {
    ctx.throw(
      404,
      `Could not find a chat with ID ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, chat };
});

router.get("/chats/:id/messages", async function (ctx) {
  const limit = Number(ctx.request.query?.limit);
  const { success, messages } = await sendAndReceive(
    ctx.state.user.sub,
    "messagesByChatId",
    {
      chat: ctx.params.id,
      limit: isNaN(limit) ? undefined : limit,
    }
  );
  if (!success) {
    ctx.throw(
      404,
      `Could not find message from chat with ID ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, messages };
});

router.post(
  "/chats/:id/buttons",
  upload.single("attachment", {
    limits: {
      fieldSize: fileSize,
      fileSize,
    },
  }),
  async function (ctx) {
    const schema = Joi.object({
      text: Joi.string().optional(),
      attachment: Joi.object().optional(),
      buttons: Joi.array()
        .items(
          Joi.object({
            id: Joi.string().optional(),
            label: Joi.string().required(),
          })
        )
        .min(1)
        .max(3)
        .required(),
      title: Joi.string().optional(),
      footer: Joi.string().optional(),
      quote: Joi.string().optional(),
      seen: Joi.boolean().optional(),
    });
    const payload = Object.assign(ctx.request.body || {}, {
      attachment: ctx.request.file,
    });
    const { error, value } = schema.validate(payload);
    if (error) {
      ctx.throw(422, error);
    }

    const { attachment, ...extra } = value;
    let mime, path;
    if (attachment) {
      mime = attachment.mimetype;
      path = newFilePath();
      await saveBufferAs(path, attachment.buffer);
    }

    const { success, message } = await sendAndReceive(
      ctx.state.user.sub,
      "sendButtons",
      {
        chat: ctx.params.id,
        ...extra,
        path,
        mime,
      }
    );
    if (!success) {
      ctx.throw(
        500,
        `Failed to send buttons to ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
      );
    }

    ctx.body = { success, message };
  }
);

router.post("/chats/:id/list", async function (ctx) {
  const schema = Joi.object({
    text: Joi.string().required(),
    label: Joi.string().required(),
    sections: Joi.array()
      .items(
        Joi.object({
          title: Joi.string().required(),
          rows: Joi.array()
            .items(
              Joi.object({
                id: Joi.string().optional(),
                title: Joi.string().required(),
                description: Joi.string().optional(),
              }).required()
            )
            .min(1)
            .required(),
        })
      )
      .min(1)
      .required(),
    title: Joi.string().optional(),
    footer: Joi.string().optional(),
    quote: Joi.string().optional(),
    seen: Joi.boolean().optional(),
  });
  const { error, value } = schema.validate(ctx.request.body || {});
  if (error) {
    ctx.throw(422, error);
  }

  const { success, message } = await sendAndReceive(
    ctx.state.user.sub,
    "sendList",
    {
      chat: ctx.params.id,
      ...value,
    }
  );
  if (!success) {
    ctx.throw(
      500,
      `Failed to send list to ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, message };
});

router.post("/chats/:id/contact", async function (ctx) {
  const schema = Joi.object({
    number: Joi.string()
      .regex(/^[1-9]\d{5,14}$/)
      .required(),
    quote: Joi.string().optional(),
    seen: Joi.boolean().optional(),
  });
  const { error, value } = schema.validate(ctx.request.body || {});
  if (error) {
    ctx.throw(422, error);
  }

  const { success, message } = await sendAndReceive(
    ctx.state.user.sub,
    "sendContact",
    {
      chat: ctx.params.id,
      ...value,
    }
  );
  if (!success) {
    ctx.throw(
      500,
      `Failed to send contact to ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, message };
});

router.post(
  "/chats/:id/file",
  upload.single("attachment", {
    limits: {
      fieldSize: fileSize,
      fileSize,
    },
  }),
  async function (ctx) {
    const schema = Joi.object({
      attachment: Joi.object().required(),
      type: Joi.string()
        .valid("audio", "document", "photo", "video")
        .required(),
      caption: Joi.string().max(255).when("type", {
        is: "document",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      quote: Joi.string().optional(),
      seen: Joi.boolean().optional(),
    });
    const payload = Object.assign(ctx.request.body || {}, {
      attachment: ctx.request.file,
    });
    const { error, value } = schema.validate(payload);
    if (error) {
      ctx.throw(422, error);
    }

    const { attachment, ...extra } = value;
    const path = newFilePath();
    await saveBufferAs(path, attachment.buffer);
    if (extra.type === "document") {
      extra.name = extra.caption;
      delete extra.caption;
    }

    const { success, message } = await sendAndReceive(
      ctx.state.user.sub,
      "sendFile",
      {
        chat: ctx.params.id,
        ...extra,
        path,
        mime: attachment.mimetype,
      }
    );
    if (!success) {
      ctx.throw(
        500,
        `Failed to send file to ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
      );
    }

    ctx.body = { success, message };
  }
);

router.post("/chats/:id/location", async function (ctx) {
  const schema = Joi.object({
    latitude: Joi.string()
      .regex(/^-?\d{1,2}\.\d+$/)
      .required(),
    longitude: Joi.string()
      .regex(/^-?\d{1,2}\.\d+$/)
      .required(),
    description: Joi.string().min(1).max(255).optional(),
    quote: Joi.string().optional(),
    seen: Joi.boolean().optional(),
  });
  const { error, value } = schema.validate(ctx.request.body || {});
  if (error) {
    ctx.throw(422, error);
  }

  const { success, message } = await sendAndReceive(
    ctx.state.user.sub,
    "sendLocation",
    {
      chat: ctx.params.id,
      ...value,
    }
  );
  if (!success) {
    ctx.throw(
      500,
      `Failed to send location to ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, message };
});

router.post("/chats/:id/text", async function (ctx) {
  const schema = Joi.object({
    text: Joi.string().min(1).max(4096).required(),
    quote: Joi.string().optional(),
    seen: Joi.boolean().optional(),
  });
  const { error, value } = schema.validate(ctx.request.body || {});
  if (error) {
    ctx.throw(422, error);
  }

  const { success, message } = await sendAndReceive(
    ctx.state.user.sub,
    "sendText",
    {
      chat: ctx.params.id,
      ...value,
    }
  );
  if (!success) {
    ctx.throw(
      500,
      `Failed to send text to ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, message };
});

router.get("/contacts", async function (ctx) {
  const { success, contacts } = await sendAndReceive(
    ctx.state.user.sub,
    "contacts"
  );
  if (!success) {
    ctx.throw(
      500,
      `Could not retrieve contacts from instance ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, contacts };
});

router.get("/contacts/:id", async function (ctx) {
  const { success, contact } = await sendAndReceive(
    ctx.state.user.sub,
    "contactById",
    { contact: ctx.params.id }
  );
  if (!success) {
    ctx.throw(
      404,
      `Could not find a contact with ID ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, contact };
});

router.get("/contacts/:id/groups", async function (ctx) {
  const { success, groups } = await sendAndReceive(
    ctx.state.user.sub,
    "groupsByContactId",
    { contact: ctx.params.id }
  );
  if (!success) {
    ctx.throw(
      404,
      `Could not find groups shared with contact ID ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, groups };
});

router.get("/groups", async function (ctx) {
  const { success, groups } = await sendAndReceive(
    ctx.state.user.sub,
    "groups"
  );
  if (!success) {
    ctx.throw(
      500,
      `Could not retrieve groups from instance ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, groups };
});

router.get("/groups/:id", async function (ctx) {
  const { success, group } = await sendAndReceive(
    ctx.state.user.sub,
    "groupById",
    { group: ctx.params.id }
  );
  if (!success) {
    ctx.throw(
      404,
      `Could not find a group with ID ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, group };
});

router.get("/groups/:id/participants", async function (ctx) {
  const { success, participants } = await sendAndReceive(
    ctx.state.user.sub,
    "groupParticipantsById",
    { group: ctx.params.id }
  );
  if (!success) {
    ctx.throw(
      404,
      `Could not find participants in group with ID ${ctx.params.id} on instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, participants };
});

router.post("/validate", async function (ctx) {
  const schema = Joi.object({
    number: Joi.string()
      .regex(/^[1-9]\d{5,14}$/)
      .required(),
  });
  const { error, value } = schema.validate(ctx.request.body || {});
  if (error) {
    ctx.throw(422, error);
  }

  const { success, valid } = await sendAndReceive(
    ctx.state.user.sub,
    "validate",
    value
  );
  if (!success) {
    ctx.throw(
      500,
      `Failed to validate to ${value.number} using instance with ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, valid };
});

module.exports = router;
