cmake_minimum_required(VERSION 3.10)
project(CryptoLizardServer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(CURL REQUIRED)
find_package(Threads REQUIRED)

# Include directories
include_directories(${CURL_INCLUDE_DIR})
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

# Add executable
add_executable(crypto_server crypto_server.cpp)

# Link libraries
target_link_libraries(crypto_server 
    ${CURL_LIBRARIES}
    Threads::Threads
)

# Install target
install(TARGETS crypto_server DESTINATION bin)
