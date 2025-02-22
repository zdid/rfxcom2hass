FROM node:22-bookworm-slim

WORKDIR /app
COPY ./package.json .
RUN yarn install --production
COPY ./dist ./dist
COPY ./config_default ./config_default
COPY ./src ./src
CMD ["node", "/app/dist/index.js"]

