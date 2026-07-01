FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install

FROM dependencies AS build
COPY apps/web apps/web
RUN npm run build -w @socialflow/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules node_modules
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/web/public apps/web/public
CMD ["npm", "run", "start", "-w", "@socialflow/web"]
