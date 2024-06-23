#!/usr/bin/env node
const debug = require("debug")("wapper:wweb");
const { Events } = require("whatsapp-web.js");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const { notifyToWebhook } = require("./utilities/common");
const { findWebhookUrls, updateWebhookUrl } = require("./utilities/mongo");
const { setUpPubSub } = require("./utilities/redis");
const {
  createClient,
  getChatById,
  getChats,
  getContactById,
  getContacts,
  getGroupById,
  getGroupParticipantsById,
  getGroups,
  getGroupsByContactId,
  getMessagesByChatId,
  isNumberRegistered,
  sendButtons,
  sendContact,
  sendFile,
  sendList,
  sendLocation,
  sendText,
  transformChat,
  transformMessage,
  transformState,
} = require("./utilities/wweb");

const argv = yargs(hideBin(process.argv)).argv;
const client = createClient(argv.instance);

let qr = null;
let systemWebhook, clientWebhook;

client.on(Events.AUTHENTICATED, () => {
  if (systemWebhook) {
    notifyToWebhook(systemWebhook, "CONNECTED", {
      instance: argv.instance,
    }).then((success) =>
      debug(`Instance ${argv.instance} connected webhook returned ${success}.`)
    );
  }
});

client.on(Events.DISCONNECTED, () => {
  if (systemWebhook) {
    notifyToWebhook(systemWebhook, "DISCONNECTED", {
      instance: argv.instance,
    }).then((success) =>
      debug(
        `Instance ${argv.instance} disconnected webhook returned ${success}.`
      )
    );
  }
});

client.on(Events.LOADING_SCREEN, (percent) => {
  console.log("Loading...", percent + "% there!");
});

client.on(Events.MESSAGE_RECEIVED, async (message) => {
  if (!!message.fromMe) return;
  const chat = await message.getChat();
  const data = {
    instance: argv.instance,
    chat: transformChat(chat),
    message: transformMessage(message),
  };
  if (systemWebhook) {
    notifyToWebhook(systemWebhook, "MESSAGE", data).then((success) =>
      debug(
        `Message ${message.id._serialized} system webhook returned ${success}.`
      )
    );
  }

  if (clientWebhook) {
    notifyToWebhook(clientWebhook, "MESSAGE", data).then((success) =>
      debug(
        `Message ${message.id._serialized} client webhook returned ${success}.`
      )
    );
  }
});

client.on(Events.QR_RECEIVED, (base64) => {
  debug("QR code received from instance.");
  qr = base64;
  if (systemWebhook) {
    notifyToWebhook(systemWebhook, "QR", { qr, instance: argv.instance }).then(
      (success) =>
        debug(`Instance ${argv.instance} QR webhook returned ${success}.`)
    );
  }
});

client.on(Events.READY, () => {
  if (systemWebhook) {
    notifyToWebhook(systemWebhook, "READY", { instance: argv.instance }).then(
      (success) =>
        debug(`Instance ${argv.instance} ready webhook returned ${success}.`)
    );
  }
});

const callback = async ({ id, cmd, origin, args }, publish) => {
  if (origin === "wweb") {
    return; // ignore self
  }

  switch (cmd) {
    case "chatById": {
      let chat = null;
      let success = false;
      try {
        chat = await getChatById(client, args.chat);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, chat });
      break;
    }
    case "chats": {
      let chats = [];
      let success = false;
      try {
        chats = await getChats(client);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, chats });
      break;
    }
    case "contactById": {
      let contact = null;
      let success = false;
      try {
        contact = await getContactById(client, args.contact);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, contact });
      break;
    }
    case "contacts": {
      let contacts = [];
      let success = false;
      try {
        contacts = await getContacts(client);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, contacts });
      break;
    }
    case "groupById": {
      let group = null;
      let success = false;
      try {
        group = await getGroupById(client, args.group);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, group });
      break;
    }
    case "groupParticipantsById": {
      let participants = null;
      let success = false;
      try {
        participants = await getGroupParticipantsById(client, args.group);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, participants });
      break;
    }
    case "groups": {
      let groups = [];
      let success = false;
      try {
        groups = await getGroups(client);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, groups });
      break;
    }
    case "groupsByContactId": {
      let groups = null;
      let success = false;
      try {
        groups = await getGroupsByContactId(client, args.contact);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, groups });
      break;
    }
    case "logout": {
      let success = false;
      try {
        await client.logout();
        // noinspection ES6MissingAwait
        client.initialize();
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success });
      break;
    }
    case "messagesByChatId": {
      let success = false;
      let messages;
      try {
        messages = await getMessagesByChatId(client, args.chat, args.limit);
        success = true;
      } catch (e) {
        debug(e);
        success = e.message;
      }

      await publish(id, cmd, { success, messages });
      break;
    }
    case "qr":
      await publish(id, cmd, { success: !!qr, qr });
      break;
    case "sendButtons": {
      let message;
      let success = false;
      try {
        message = await sendButtons(client, args.chat, args);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, message });
      break;
    }
    case "sendContact": {
      let message;
      let success = false;
      try {
        message = await sendContact(client, args.chat, args.number, args);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, message });
      break;
    }
    case "sendFile": {
      let message;
      let success = false;
      try {
        message = await sendFile(client, args.chat, args.path, args.mime, args);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, message });
      break;
    }
    case "sendList": {
      let message;
      let success = false;
      try {
        message = await sendList(client, args.chat, args);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, message });
      break;
    }
    case "sendLocation": {
      let message;
      let success = false;
      try {
        message = await sendLocation(
          client,
          args.chat,
          args.latitude,
          args.longitude,
          args
        );
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, message });
      break;
    }
    case "sendText": {
      let message;
      let success = false;
      try {
        message = await sendText(client, args.chat, args.text, args);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, message });
      break;
    }
    case "setUpWebhook":
      clientWebhook = args.url || undefined;
      await updateWebhookUrl(argv.instance, "client", clientWebhook);
      await publish(id, cmd, { success: true });
      break;
    case "status": {
      let success = false;
      let status;
      try {
        const me = client.info?.wid?._serialized;
        const state = await client.getState();
        const version = await client.getWWebVersion();
        status = { me, state: transformState(state), version };
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, status });
      break;
    }
    case "validate": {
      let success = false;
      let valid;
      try {
        valid = await isNumberRegistered(client, args.number);
        success = true;
      } catch (e) {
        debug(e);
      }

      await publish(id, cmd, { success, valid });
      break;
    }
    default:
      debug(`Unknown command ${cmd} received.`);
      await publish(id, cmd, { success: false });
      break;
  }
};

(async function () {
  const urls = await findWebhookUrls(argv.instance);
  clientWebhook = urls.client;
  systemWebhook = urls.system;
  const { publish, subscribe } = await setUpPubSub(argv.instance, "wweb");
  subscribe((message) => callback(message, publish));
  await client.initialize();
})();

process.on("SIGINT", () => {
  debug("Shutting down client.");
  client.destroy().then(() => process.exit(0));
});
