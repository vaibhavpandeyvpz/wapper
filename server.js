const debug = require("debug")("wapper:server");
const http = require("http");
const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const logger = require("koa-logger");
const json = require("koa-json");
const responseTime = require("koa-response-time");
const Router = require("@koa/router");
const koaStatic = require("koa-static");
const path = require("path");

const controllers = require("./controllers");
const { saveRequestLog } = require("./utilities/mongo");

const app = new Koa();

app.use(async function (ctx, next) {
  try {
    await next();
  } catch (e) {
    debug(e);
    ctx.status = e.statusCode || e.status || 500;
    ctx.body = {
      success: false,
      message: e.message || "Unknown server error occurred.",
    };
  }

  if (ctx.state?.user?.sub) {
    await saveRequestLog(
      ctx.state.user.sub,
      ctx.method,
      ctx.originalUrl,
      ctx.status
    );
  }
});

app
  .use(responseTime({ hrtime: true }))
  .use(koaStatic(path.join(__dirname, "public")))
  .use(bodyParser())
  .use(logger())
  .use(json({ pretty: false, param: "pretty" }));

const router = new Router();

router.use(
  controllers.admin.routes(),
  controllers.admin.allowedMethods(),
  controllers.wapi.routes(),
  controllers.wapi.allowedMethods()
);

app.use(router.routes()).use(router.allowedMethods());

const server = http.createServer(app.callback());
const port = process.env.PORT || 3000;

server.listen(port, () => {
  debug(`Listening on *:${port}`);
});
