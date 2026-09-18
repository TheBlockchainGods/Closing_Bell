# Build from repo root:
#   docker build -f backend/Dockerfile -t closing-bell-api:latest .
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY packages/fairness/package.json ./packages/fairness/
COPY packages/fairness/tsconfig.json ./packages/fairness/
COPY packages/fairness/src ./packages/fairness/src/
COPY backend/package.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/fixtures ./backend/fixtures/
COPY backend/assets ./backend/assets/
COPY backend/src ./backend/src/

RUN npm install --workspace=@closing-bell/fairness --workspace=@closing-bell/backend \
  && npm run build -w @closing-bell/fairness \
  && cd backend && npx tsc -p tsconfig.json

WORKDIR /app/backend

ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "dist/index.js"]
