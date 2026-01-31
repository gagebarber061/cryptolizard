FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    libcurl4-openssl-dev \
    nlohmann-json3-dev \
    libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Download Crow header-only library (use direct download instead of git clone)
RUN mkdir -p /app/include && \
    wget https://raw.githubusercontent.com/CrowCpp/Crow/master/include/crow_all.h -O /app/include/crow.h

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
