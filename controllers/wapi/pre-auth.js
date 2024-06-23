const qrcode = require("qrcode");
const Router = require("@koa/router");

const { sendAndReceive } = require("../../utilities/redis");

const router = new Router();

router.put("/logout", async function (ctx) {
  const { success } = await sendAndReceive(ctx.state.user.sub, "logout");
  if (!success) {
    ctx.throw(500, `Failed to logout from instance ID ${ctx.state.user.sub}.`);
  }

  ctx.body = { success };
});

router.get("/qr", async function (ctx) {
  const { success, qr } = await sendAndReceive(ctx.state.user.sub, "qr");
  if (!success || !qr) {
    ctx.throw(
      404,
      `Failed to get QR code for instance ID ${ctx.state.user.sub}.`
    );
  }

  const json = ctx.header.accept?.includes("application/json");
  if (json) {
    ctx.body = { success, qr };
  } else {
    const image = await qrcode.toBuffer(qr);
    ctx.response.set("content-type", "image/png");
    ctx.response.set("content-disposition", "inline");
    ctx.body = image;
  }
});

router.get("/status", async function (ctx) {
  const { success, status } = await sendAndReceive(
    ctx.state.user.sub,
    "status"
  );
  if (!success) {
    ctx.throw(
      500,
      `Could not get connection status for instance ID ${ctx.state.user.sub}.`
    );
  }

  ctx.body = { success, ...status };
});

module.exports = router;
