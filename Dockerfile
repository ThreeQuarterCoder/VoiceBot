# Use official Node.js image
FROM node:18

# Set working directory to /app
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the port
EXPOSE 3030

# Run the server
CMD ["node", "server.js"]
