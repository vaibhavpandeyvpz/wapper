const Router = require("@koa/router");

const { jwtMiddleware } = require("../../utilities/security");
const preAuth = require("./pre-auth");
const postAuth = require("./post-auth");

const router = new Router({ prefix: "/wapi" });

router.use(jwtMiddleware());

router.use(
  preAuth.routes(),
  preAuth.allowedMethods(),
  postAuth.routes(),
  postAuth.allowedMethods()
);

module.exports = router;
