FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js render.js styles.js ./
# Sites live on a volume so a redeploy never takes the content with it.
COPY sites /seed
VOLUME ["/sites"]
ENV SITES_DIR=/sites PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
