const path = require("path");
const pm2 = require("pm2");

async function connect() {
  return new Promise((resolve, reject) => {
    pm2.connect(function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function disconnect() {
  return new Promise((resolve) => {
    pm2.disconnect();
    resolve();
  });
}

async function dump() {
  return new Promise((resolve, reject) => {
    pm2.dump(function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function remove(app) {
  return new Promise((resolve, reject) => {
    pm2.delete(app, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function restart(app) {
  return new Promise((resolve, reject) => {
    pm2.restart(app, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function runOrFail(promise) {
  await connect();
  try {
    return await promise();
  } finally {
    await disconnect();
  }
}

async function start(app) {
  const options = {
    name: app,
    args: `--instance ${app}`,
    cwd: path.resolve(path.join(__dirname, "..")),
    env: {
      DEBUG: process.env.DEBUG,
      CHROME_BINARY: process.env.CHROME_BINARY,
      MONGO_DATABASE: process.env.MONGO_DATABASE,
      MONGO_URL: process.env.MONGO_URL,
      REDIS_URL: process.env.REDIS_URL,
    },
    script: path.resolve(path.join(__dirname, "..", "wweb.js")),
  };
  return new Promise((resolve, reject) => {
    pm2.start(options, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function stop(app) {
  return new Promise((resolve, reject) => {
    pm2.stop(app, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  dump,
  remove,
  restart,
  runOrFail,
  start,
  stop,
};
