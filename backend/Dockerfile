FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MPLCONFIGDIR=/home/vectorfaces/matplotlib \
    FONTCONFIG_CACHE=/home/vectorfaces/fontconfig

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    curl \
    bash \
    libopencv-dev \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgoogle-perftools4 \
    && rm -rf /var/lib/apt/lists/*

# Install uv 
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

COPY requirements.txt .

RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

RUN groupadd -r vectorfaces && useradd -r -g vectorfaces -m vectorfaces

# Create matplotlib and fontconfig cache directories and set permissions
RUN mkdir -p /home/vectorfaces/matplotlib /home/vectorfaces/fontconfig /home/vectorfaces/.insightface && \
    chown -R vectorfaces:vectorfaces /home/vectorfaces && \
    chown -R vectorfaces:vectorfaces /app && \
    chmod 755 /home/vectorfaces/matplotlib /home/vectorfaces/fontconfig /home/vectorfaces/.insightface

USER vectorfaces

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/health')" || exit 1

# Run the application with uvicorn (initialization happens via startup event)
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]