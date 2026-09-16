FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY fixtures ./fixtures
COPY src ./src

RUN npm run build

ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "dist/index.js"]
