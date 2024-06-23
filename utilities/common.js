const axios = require("axios");

const webhookTimeout = 15 * 1000; // 15 seconds

async function notifyToWebhook(url, event, data, timeout = webhookTimeout) {
  return axios
    .post(url, { event, ...data }, { timeout })
    .then(() => true)
    .catch(() => false);
}

module.exports = {
  notifyToWebhook,
};
