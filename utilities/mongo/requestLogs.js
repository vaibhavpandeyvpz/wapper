const { connect } = require("./common");

async function saveRequestLog(instanceId, method, path, status) {
  const db = await connect();
  const httpLogs = db.collection("httpLogs");
  await httpLogs.insertOne({
    instanceId,
    method,
    path,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

module.exports = { saveRequestLog };
