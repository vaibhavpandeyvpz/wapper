const fs = require("fs");
const { DateTime } = require("luxon");
const {
  Buttons,
  Client,
  List,
  LocalAuth,
  Location,
  MessageAck,
  MessageMedia,
  WAState,
} = require("whatsapp-web.js");

function createClient(clientId) {
  return new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath: process.env.WWEBJS_AUTH_PATH || "/userdata/auth",
    }),
    puppeteer: {
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--disable-software-rasterizer",
      ],
      executablePath: process.env.CHROME_BINARY,
    },
    webVersionCache: {
      type: "remote",
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2407.3.html",
    },
  });
}

async function getChatById(client, id) {
  return client.getChats().then((chats) => {
    const chat = chats.find((x) => x.id._serialized === id);
    if (!chat) {
      throw new Error(`Could not find a chat with ID ${id} on this instance.`);
    }

    return transformChat(chat);
  });
}

async function getChats(client) {
  return client.getChats().then((chats) => chats.map(transformChat));
}

async function getContactById(client, id) {
  return client.getContacts().then((contacts) => {
    const contact = contacts.find((x) => x.id._serialized === id);
    if (!contact) {
      throw new Error(
        `Could not find a contact with ID ${id} on this instance.`
      );
    }

    return transformContact(contact);
  });
}

async function getContacts(client) {
  return client
    .getContacts()
    .then((contacts) => contacts.map(transformContact));
}

async function getGroupById(client, id) {
  return client.getChats().then((chats) => {
    const chat = chats.find((x) => x.isGroup && x.id._serialized === id);
    if (!chat) {
      throw new Error(`Could not find a group with ID ${id} on this instance.`);
    }

    return transformChat(chat);
  });
}

async function getGroupParticipantsById(client, id) {
  return client.getChats().then((chats) => {
    const chat = chats.find((x) => x.isGroup && x.id._serialized === id);
    if (!chat) {
      throw new Error(`Could not find a group with ID ${id} on this instance.`);
    }

    return chat.participants.map(transformGroupParticipant);
  });
}

async function getGroups(client) {
  return client
    .getChats()
    .then((chats) => chats.filter((x) => x.isGroup))
    .then((chats) => chats.map(transformChat));
}

async function getGroupsByContactId(client, id) {
  return Promise.all([client.getChats(), client.getCommonGroups(id)])
    .then(([chats, commonGroups]) => {
      const commonGroupIds = commonGroups.map((x) => x._serialized);
      return chats.filter((x) => commonGroupIds.includes(x.id._serialized));
    })
    .then((chats) => chats.map(transformChat));
}

async function getMessagesByChatId(client, chatId, limit) {
  return client.getChatById(chatId).then((chat) => {
    return chat
      .fetchMessages({ limit })
      .then((messages) => messages.map(transformMessage));
  });
}

async function isNumberRegistered(client, number) {
  return client.isRegisteredUser(number + "@c.us");
}

async function sendButtons(client, chatId, args = {}) {
  const options = {
    quotedMessageId: args.quote,
    sendSeen: !!args.seen,
  };
  const buttons = args.buttons.map((x) => ({
    id: x.id,
    body: x.label,
  }));
  return client
    .sendMessage(
      chatId,
      new Buttons(args.text, buttons, args.title, args.footer),
      options
    )
    .then((message) => message.id._serialized);
}

async function sendContact(client, chatId, number, args = {}) {
  return client.getContactById(number + "@c.us").then((contact) => {
    const options = {
      quotedMessageId: args.quote,
      sendSeen: !!args.seen,
    };
    return client
      .sendMessage(chatId, contact, options)
      .then((message) => message.id._serialized);
  });
}

async function sendFile(client, chatId, path, mime, args = {}) {
  const media = MessageMedia.fromFilePath(path);
  media.mimetype = mime;
  if (args.name) {
    media.filename = args.name;
  }

  const options = {
    caption: args.caption,
    quotedMessageId: args.quote,
    sendSeen: !!args.seen,
  };
  return client
    .sendMessage(chatId, media, options)
    .then((message) => message.id._serialized)
    .finally(() => fs.unlinkSync(path));
}

async function sendList(client, chatId, args = {}) {
  const options = {
    quotedMessageId: args.quote,
    sendSeen: !!args.seen,
  };
  return client
    .sendMessage(
      chatId,
      new List(args.text, args.label, args.sections, args.title, args.footer),
      options
    )
    .then((message) => message.id._serialized);
}

async function sendLocation(client, chatId, latitude, longitude, args) {
  const options = {
    quotedMessageId: args.quote,
    sendSeen: !!args.seen,
  };
  return client
    .sendMessage(
      chatId,
      new Location(Number(latitude), Number(longitude), args.description),
      options
    )
    .then((message) => message.id._serialized);
}

async function sendText(client, chatId, text, args) {
  const options = {
    quotedMessageId: args.quote,
    sendSeen: !!args.seen,
  };
  return client
    .sendMessage(chatId, text, options)
    .then((message) => message.id._serialized);
}

const transformChat = (x) => ({
  id: x.id._serialized,
  name: x.name || null,
  unread: x.unreadCount || 0,
  flags: {
    archived: !!x.archived,
    group: x.isGroup,
    muted: x.isMuted,
    pinned: x.pinned,
    readonly: x.isReadOnly,
  },
  last_activity_at: x.timestamp
    ? DateTime.fromSeconds(x.timestamp).toISO()
    : null,
});

const transformContact = (x) => ({
  id: x.id._serialized,
  number: x.number,
  name: {
    contact: x.name,
    push: x.pushname,
    short: x.shortName,
    verified: x.verifiedName,
  },
  flags: {
    me: x.isMe,
    blocked: x.isBlocked,
    contact: x.isMyContact,
    business: x.isBusiness,
    group: x.isGroup,
    wacontact: x.isWAContact,
  },
});

const transformGroupParticipant = (x) => ({
  id: x.id._serialized,
  admin: x.isAdmin,
});

const transformMessage = (x) => ({
  id: x.id._serialized,
  type: x.type,
  device: x.deviceType || null,
  sender: x.from,
  recipient: x.to,
  outgoing: !!x.fromMe,
  body: x.body || null,
  location: x.location || null,
  vcards: x.vCards || [],
  links: x.links?.map(({ link }) => link),
  ack: transformMessageAck(x.ack),
  flags: {
    broadcast: !!x.broadcast,
    ephemeral: !!x.isEphemeral,
    gif: !!x.isGif,
    forwarded: !!x.isForwarded,
    media: !!x.hasMedia,
    quoted: !!x.hasQuotedMsg,
    starred: !!x.isStarred,
    status: !!x.isStatus,
  },
  sent_or_received_at: DateTime.fromSeconds(x.timestamp).toISO(),
});

const transformMessageAck = (x) => {
  switch (x) {
    case MessageAck.ACK_ERROR:
      return "ERROR";
    case MessageAck.ACK_PENDING:
      return "PENDING";
    case MessageAck.ACK_SERVER:
      return "SENT";
    case MessageAck.ACK_DEVICE:
      return "DELIVERED";
    case MessageAck.ACK_READ:
      return "READ";
    case MessageAck.ACK_PLAYED:
      return "PLAYED";
    default:
      return "UNKNOWN";
  }
};

const transformState = (state) => {
  switch (state) {
    case WAState.PROXYBLOCK:
    case WAState.SMB_TOS_BLOCK:
    case WAState.TOS_BLOCK:
      return "BLOCKED";
    case WAState.CONNECTED:
      return "CONNECTED";
    case WAState.CONFLICT:
    case WAState.DEPRECATED_VERSION:
    case WAState.UNLAUNCHED:
    case WAState.TIMEOUT:
      return "ERRORED";
    case WAState.OPENING:
    case WAState.PAIRING:
      return "LOADING";
    case WAState.UNPAIRED:
    case WAState.UNPAIRED_IDLE:
    default:
      return "DISCONNECTED";
  }
};

module.exports = {
  createClient,
  getContactById,
  getContacts,
  getChatById,
  getChats,
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
  transformContact,
  transformGroupParticipant,
  transformMessage,
  transformMessageAck,
  transformState,
};
