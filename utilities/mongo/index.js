const common = require("./common");
const instances = require("./instances");
const requestLogs = require("./requestLogs");
const webhooks = require("./webhooks");

module.exports = {
  ...common,
  ...instances,
  ...requestLogs,
  ...webhooks,
};
