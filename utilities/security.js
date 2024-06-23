const jsonwebtoken = require("jsonwebtoken");
const basicAuth = require("koa-basic-auth");
const jwt = require("koa-jwt");

const { findInstance } = require("./mongo");

const adminUser = process.env.ADMIN_USER;
const adminPassword = process.env.ADMIN_PASSWORD;
const jwtSecret = process.env.JWT_SECRET;

const adminMiddleware = () =>
  basicAuth({
    name: adminUser,
    pass: adminPassword,
  });

function createInstanceToken(instanceId, expiry = 24 /* hours */) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * expiry;
  return jsonwebtoken.sign({ sub: instanceId, exp }, jwtSecret);
}

function instanceMiddleware() {
  return async function (ctx, next) {
    const instance = await findInstance(ctx.state.user.sub);
    if (!instance) {
      ctx.throw(401, "The authorized instance no longer exists.");
    }

    await next();
  };
}

module.exports = {
  adminMiddleware,
  createInstanceToken,
  instanceMiddleware,
  jwtMiddleware: () => jwt({ secret: jwtSecret }),
};
