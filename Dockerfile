FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build && ./node_modules/.bin/tsc --noEmit false --outDir dist
RUN npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production PORT=3100 WORDRAVA_UNIVERSAL_DISCOVERY_ENABLED=false
WORKDIR /app
COPY --from=build /app/node_modules/ ./node_modules/
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/package.json ./
USER node
EXPOSE 3100
CMD ["node", "dist/server.js"]

