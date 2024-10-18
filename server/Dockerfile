FROM node:alpine3.10

WORKDIR /home/app

# Copy package.json and package-lock.json
COPY package*.json ./
COPY /src /src
COPY tsconfig.json tsconfig.json

# Install all dependencies including devDependencies (like TypeScript)
RUN npm install

# Default command
CMD ["npm", "run", "build"]
