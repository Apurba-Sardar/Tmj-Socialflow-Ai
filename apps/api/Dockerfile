FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
RUN npm install

FROM dependencies AS build
COPY apps/api apps/api
RUN npm run build -w @socialflow/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
CMD ["node", "apps/api/dist/main.js"]
