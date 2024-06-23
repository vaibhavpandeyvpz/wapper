const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URL);
const dbName = process.env.MONGO_DATABASE;

let connected;

async function connect() {
  if (!connected) {
    await client.connect();
    connected = true;
  }

  return client.db(dbName);
}

async function disconnect() {
  if (connected) {
    await client.close();
    connected = false;
  }
}

module.exports = { connect, disconnect };
