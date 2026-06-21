FROM node:20-alpine

WORKDIR /app
COPY package.json ./package.json
COPY bootstrap.js ./bootstrap.js

ENV NODE_ENV=production
CMD ["npm", "start"]
