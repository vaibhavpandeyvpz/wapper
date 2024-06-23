# wapper

Fully-featured [Node.js](https://nodejs.org/en/) API to deploy instant bots built on [WhatsApp](https://www.whatsapp.com/) Web.
It allows to send text, location, contact, documents or media messages in bulk or listen/respond to incoming messages using HTTP webhooks.

Powered by [whatsapp-web.js](https://wwebjs.dev/) and built using [Koa](https://koajs.com/), [Mongo](https://www.mongodb.com/), [Redis](https://redis.io/) and [PM2](https://pm2.keymetrics.io/).

### Development

Firstly, make sure you have [Docker](https://www.docker.com/), [Node.js](https://nodejs.org/en/) and [Yarn](https://yarnpkg.com/) installed on your workstation.
Clone or download the project and run below commands to start the development server.

```shell
# create a copy of sample .env file
cp .env.example .env

# start required services (e.g., Mongo, Redis etc.)
docker compose up -d
```

### Usage

Endpoints are documented in the included [Postman](https://www.postman.com/) collection i.e., [Wapper.postman_collection.json](Wapper.postman_collection.json) with sample requests.

### Deployment

To help quickly configure a VPS server, install all dependencies and set up the project, there are [Terraform](https://www.terraform.io/) scripts and [Ansible](https://www.ansible.com/) playbooks in `deployment` folder ready to configure a server on [DigitalOcean](https://m.do.co/c/fbca1e70a3ab).

If you are configuring things manually, below is an example [pm2](https://pm2.keymetrics.io/) configuration which can be used:

```js
module.exports = {
  apps: [
    {
      name: "server",
      script: "server.js",
      cwd: "<code_location>",
      env: {
        ADMIN_USER: "<secret>",
        ADMIN_PASSWORD: "<very_secret>",
        CHROME_BINARY: "/usr/bin/google-chrome-stable",
        DEBUG: "wapper:*",
        JWT_SECRET: "<secret>",
        MONGO_URL: "mongodb://127.0.0.1:27017",
        MONGO_DATABASE: "wapper",
        NODE_ENV: "production",
        REDIS_URL: "redis://127.0.0.1:6379",
        WWEBJS_AUTH_PATH: "<code_location>/.wwebjs_auth",
        WWEBJS_CACHE_PATH: "<code_location>/.wwebjs_cache",
      },
    },
  ],
};
```

Save above contents to a `ecosystem.config.js` (obviously replace values between `<` and `>`) file on the server and run below command to start services:

```shell
# start the apps
$ pm2 start ecosystem.config.js

# ensure auto restart
$ pm2 save
```

### Disclaimer

Built for research and personal usages only, use as your own risk.
This project is not affiliated, associated, authorized or endorsed by WhatsApp or any of its subsidiaries.
WhatsApp as well as related names, marks, emblems and images are registered trademarks of their respective owners.

### License

Please see [LICENSE](LICENSE) file.
