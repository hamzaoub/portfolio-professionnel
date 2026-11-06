FROM node:24-alpine AS build
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY shared/ /workspace/shared/
ENV VITE_API_URL=""
RUN npm run build

FROM nginx:alpine AS production
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html
EXPOSE 80

FROM node:24-alpine AS development

WORKDIR /workspace/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
COPY shared/ /workspace/shared/

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
