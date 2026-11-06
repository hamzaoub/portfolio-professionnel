FROM postgres:16-alpine AS database
COPY backend/db/init.sql /docker-entrypoint-initdb.d/init.sql

FROM node:24-alpine AS build
WORKDIR /workspace/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
COPY shared/ /workspace/shared/
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS production
WORKDIR /workspace/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
COPY --from=build /workspace/backend/node_modules ./node_modules
COPY --from=build /workspace/backend/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/backend/src/index.js"]

FROM node:24-alpine AS development

WORKDIR /workspace/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
COPY shared/ /workspace/shared/

EXPOSE 3000

# Mode développement (rechargement automatique avec tsx)
CMD ["npm", "run", "dev"]
