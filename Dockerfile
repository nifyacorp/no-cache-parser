FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install dependencies
COPY no-cache-parser/package.json ./
RUN npm install --omit=dev && npm cache clean --force;

# Copy source
COPY no-cache-parser ./

EXPOSE 8080
CMD ["npm", "start"] 