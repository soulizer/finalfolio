FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV FINALFOLIO_DATA_ROOT=/data

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY scripts ./scripts
COPY --from=build /app/dist ./dist

# The app only needs to write inside /data (bind-mounted in compose). Running as the
# unprivileged node user keeps uploaded photos and account records out of reach if the
# process is compromised. On the host run:
#   chown -R 1000:1000 /opt/finalfolio/app/data
RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["npm", "run", "start"]
