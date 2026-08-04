FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and Prisma
COPY . .

# Generate Prisma Client & Build NestJS
RUN npx prisma generate
RUN npm run build

EXPOSE 3002

CMD ["npm", "run", "start"]