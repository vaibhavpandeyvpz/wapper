const Router = require("@koa/router");

const instances = require("./instances");
const wapi = require("./wapi");
const { adminMiddleware } = require("../utilities/security");

const admin = new Router({ prefix: "/admin" });

admin.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (401 === err.status) {
      ctx.status = 401;
      ctx.set("WWW-Authenticate", "Basic");
    } else {
      throw err;
    }
  }
});

admin.use(adminMiddleware());

admin.use(instances.routes(), instances.allowedMethods());

module.exports = {
  admin,
  wapi,
};
