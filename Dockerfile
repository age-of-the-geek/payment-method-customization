FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

# Copy the rest and build
COPY . .
RUN npm run build

# Railway provides PORT at runtime
ENV NODE_ENV=production
EXPOSE 8080

# Start the server
CMD ["npm","run","start"]
