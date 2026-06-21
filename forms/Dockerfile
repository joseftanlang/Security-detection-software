# Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the app
COPY . .

# Set environment variable for production
ENV NODE_ENV=production

# Start the app
CMD ["node", "src/index.js"]
