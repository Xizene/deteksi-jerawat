FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and GLib
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application code
COPY . .

# Set environment variable for the port
ENV PORT=7860

# Command to run the application (Hugging Face exposes port 7860)
CMD ["uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "7860"]
