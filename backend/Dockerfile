FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libcurl4-openssl-dev \
    nlohmann-json3-dev \
    libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Download Crow header-only library
RUN git clone https://github.com/CrowCpp/Crow.git /tmp/crow && \
    mkdir -p /app/include && \
    cp /tmp/crow/include/crow_all.h /app/include/crow.h && \
    rm -rf /tmp/crow

# Copy source files
COPY crypto_server.cpp .
COPY CMakeLists.txt .

# Build the application
RUN mkdir build && cd build && \
    cmake .. && \
    make -j$(nproc)

# Expose port (Render will set the PORT env var)
EXPOSE 8080

# Run the server
WORKDIR /app/build
CMD ["./crypto_server"]
