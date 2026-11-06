FROM node:24-alpine

WORKDIR /workspace/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
COPY shared/ /workspace/shared/

EXPOSE 3000

# Mode développement (rechargement automatique avec tsx)
CMD ["npm", "run", "dev"]
