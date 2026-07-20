FROM node:20-slim

WORKDIR /usr/src/app

# Use production environment inside container by default
ENV NODE_ENV=production

# Install dependencies. package-lock.json optional.
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund

# Copy application
COPY . .

# Ensure uploads/logs folders exist and have sensible perms
RUN mkdir -p /usr/src/app/private_uploads /usr/src/app/logs && chown -R node:node /usr/src/app/private_uploads /usr/src/app/logs

USER node

EXPOSE 3000
CMD ["node", "index.js"]
