FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set Environment variable & Build Next.js
ARG NEXT_PUBLIC_WS_URL=http://localhost:3002
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]