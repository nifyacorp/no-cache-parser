FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy source code
COPY src ./src
COPY README.md ./

EXPOSE 8080
CMD ["npm", "start"]
