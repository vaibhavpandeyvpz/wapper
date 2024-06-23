const { v4: uuid } = require("uuid");
const { connect } = require("./common");

async function createInstance() {
  const db = await connect();
  const instances = db.collection("instances");
  const instanceId = uuid();
  await instances.insertOne({
    instanceId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return instanceId;
}

async function deleteInstance(instanceId) {
  const db = await connect();
  const instances = db.collection("instances");
  await instances.deleteOne({ instanceId });
}

async function findInstance(instanceId) {
  const db = await connect();
  const instances = db.collection("instances");
  return instances.findOne({ instanceId });
}

module.exports = {
  createInstance,
  deleteInstance,
  findInstance,
};
