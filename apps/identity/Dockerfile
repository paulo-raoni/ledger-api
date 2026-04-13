FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/identity/package.json apps/identity/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

EXPOSE 3002

CMD ["npm", "--workspace", "@ledger/identity", "run", "start"]
