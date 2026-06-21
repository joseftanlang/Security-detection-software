FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js ./index.js

ENV NODE_ENV=production
EXPOSE 3031
CMD ["npm", "start"]
