FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/ledger/package.json apps/ledger/package.json
COPY apps/identity/package.json apps/identity/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "--workspace", "@ledger/ledger", "run", "start"]
