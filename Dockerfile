FROM zenika/alpine-chrome:with-puppeteer

# change to root temporarily
USER root

# create a data directory
RUN mkdir -p /userdata/auth /userdata/cache
RUN chown -R chrome:chrome /userdata

# change to "chrome" for installing deps
USER chrome

# change working directory
WORKDIR /app

# copy package information
COPY --chown=chrome:chrome package.json .
COPY --chown=chrome:chrome yarn.lock .

# install project dependencies
RUN yarn install --frozen-lockfile

# copy all project files
COPY --chown=chrome:chrome . .

# start the API server
CMD ["node", "server.js"]
