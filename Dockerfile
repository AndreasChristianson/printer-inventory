FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
# Numeric so the kubelet can verify runAsNonRoot (1000 is "node").
USER 1000:1000
EXPOSE 8080
CMD ["node", "src/server.js"]
