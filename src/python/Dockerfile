# Use lightweight Python 3.9 base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies for webrtcvad and pydub
RUN apt-get update && apt-get install -y \
    gcc \
    libc-dev \
    libffi-dev \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*


COPY mod_server.py .

# Install Python dependencies
RUN pip install --no-cache-dir websockets requests pydub webrtcvad numpy python-dotenv

# Verify dependencies
RUN python -c "import websockets, requests, pydub, webrtcvad" \
    && echo "Dependencies verified" \
    || (echo "Dependency check failed" && exit 1)

# Expose WebSocket port
EXPOSE 3030

# Run the voice bot
CMD ["python", "mod_server.py"]
