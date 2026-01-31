#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <thread>
#include <chrono>
#include <mutex>
#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include "crow.h"

using json = nlohmann::json;
using namespace std;

// Configuration
const string API_KEY = "CG-MPDfjn4G4i6Ru79Lb3oNuiUA";
const string BASE_URL = "https://api.coingecko.com/api/v3";
const int RATE_LIMIT_MS = 2000; // 2 seconds between calls (30 per minute)
const int UPDATE_INTERVAL = 5 * 60; // 5 minutes in seconds
const int TOP_COINS_COUNT = 50;

// Global data storage
struct CoinData {
    string id;
    int rank;
    string name;
    string symbol;
    string logo;
    double price;
    double change24h;
    double marketCap;
    double volume24h;
    double circulatingSupply;
    double totalSupply;
    double maxSupply;
    double ath;
    double athChangePercentage;
    string athDate;
    vector<double> sparkline7d;
    
    // Historical data
    map<string, vector<pair<long long, double>>> historicalData; // period -> [(timestamp, price)]
};

struct GlobalStats {
    double totalMarketCap;
    double totalVolume;
    double btcDominance;
    int activeCryptocurrencies;
    double marketCapChange24h;
    double volumeChange24h;
};

struct TrendingCoin {
    string id;
    string name;
    string symbol;
    string logo;
    int rank;
};

struct TrendingCategory {
    string name;
    string trend;
};

// Global storage with mutex for thread safety
mutex dataMutex;
vector<CoinData> topCoins;
GlobalStats globalStats;
vector<TrendingCoin> trendingCoins;
vector<TrendingCategory> trendingCategories;
bool dataReady = false;

// Utility function for HTTP requests
size_t WriteCallback(void* contents, size_t size, size_t nmemb, string* userp) {
    userp->append((char*)contents, size * nmemb);
    return size * nmemb;
}

string makeAPIRequest(const string& endpoint) {
    CURL* curl;
    CURLcode res;
    string response;
    
    curl = curl_easy_init();
    if(curl) {
        string url = BASE_URL + endpoint;
        
        // Add API key if needed
        struct curl_slist* headers = NULL;
        headers = curl_slist_append(headers, ("x-cg-demo-api-key: " + API_KEY).c_str());
        
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);
        
        res = curl_easy_perform(curl);
        
        if(res != CURLE_OK) {
            cerr << "❌ CURL error: " << curl_easy_strerror(res) << endl;
        }
        
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
    
    return response;
}

void rateLimitSleep() {
    this_thread::sleep_for(chrono::milliseconds(RATE_LIMIT_MS));
}

// Fetch top coins with current data
void fetchTopCoins() {
    cout << "📊 Fetching top " << TOP_COINS_COUNT << " coins..." << endl;
    
    string endpoint = "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=" + 
                      to_string(TOP_COINS_COUNT) + 
                      "&page=1&sparkline=true&price_change_percentage=24h";
    
    string response = makeAPIRequest(endpoint);
    
    if(response.empty()) {
        cerr << "❌ Failed to fetch top coins" << endl;
        return;
    }
    
    try {
        json data = json::parse(response);
        
        lock_guard<mutex> lock(dataMutex);
        
        // If this is the first load, clear and populate
        bool isFirstLoad = topCoins.empty();
        
        if(isFirstLoad) {
            topCoins.clear();
        }
        
        int count = 0;
        for(const auto& coin : data) {
            try {
                CoinData c;
                c.id = coin.value("id", "");
                c.rank = coin.value("market_cap_rank", 0);
                c.name = coin.value("name", "");
                c.symbol = coin.value("symbol", "");
                c.logo = coin.value("image", "");
                c.price = coin.value("current_price", 0.0);
                c.change24h = coin.value("price_change_percentage_24h", 0.0);
                c.marketCap = coin.value("market_cap", 0.0);
                c.volume24h = coin.value("total_volume", 0.0);
                c.circulatingSupply = coin.value("circulating_supply", 0.0);
                
                // Handle null values for total_supply and max_supply
                c.totalSupply = coin["total_supply"].is_null() ? 0.0 : coin["total_supply"].get<double>();
                c.maxSupply = coin["max_supply"].is_null() ? 0.0 : coin["max_supply"].get<double>();
                
                c.ath = coin.value("ath", 0.0);
                c.athChangePercentage = coin.value("ath_change_percentage", 0.0);
                c.athDate = coin.value("ath_date", "");
                
                // Extract sparkline data (7 days)
                if(coin.contains("sparkline_in_7d") && coin["sparkline_in_7d"].contains("price")) {
                    c.sparkline7d = coin["sparkline_in_7d"]["price"].get<vector<double>>();
                }
                
                if(isFirstLoad) {
                    // First load - just add the coin
                    topCoins.push_back(c);
                } else {
                    // Update - find existing coin and update its current data, preserve historical data
                    bool found = false;
                    for(auto& existingCoin : topCoins) {
                        if(existingCoin.id == c.id) {
                            // Update current data
                            existingCoin.rank = c.rank;
                            existingCoin.price = c.price;
                            existingCoin.change24h = c.change24h;
                            existingCoin.marketCap = c.marketCap;
                            existingCoin.volume24h = c.volume24h;
                            existingCoin.circulatingSupply = c.circulatingSupply;
                            existingCoin.totalSupply = c.totalSupply;
                            existingCoin.maxSupply = c.maxSupply;
                            existingCoin.ath = c.ath;
                            existingCoin.athChangePercentage = c.athChangePercentage;
                            existingCoin.athDate = c.athDate;
                            existingCoin.sparkline7d = c.sparkline7d;
                            // Keep historicalData intact!
                            found = true;
                            break;
                        }
                    }
                    
                    // If coin not found (new coin in top 50), add it
                    if(!found) {
                        topCoins.push_back(c);
                    }
                }
                
                count++;
                
                if(isFirstLoad) {
                    cout << "✅ [" << count << "/" << TOP_COINS_COUNT << "] " 
                         << c.name << " (" << c.symbol << ")" << endl;
                    cout << "    Price: $" << c.price << " | 24h: " 
                         << (c.change24h >= 0 ? "+" : "") << c.change24h << "%" 
                         << " | MCap: $" << (c.marketCap / 1e9) << "B" << endl;
                }
            } catch(const exception& e) {
                cerr << "⚠️  Skipping coin due to error: " << e.what() << endl;
                continue;
            }
        }
        
        if(!isFirstLoad) {
            cout << "✅ Updated " << count << " coins with latest prices" << endl;
        } else {
            cout << "✅ Fetched " << topCoins.size() << " coins successfully" << endl;
        }

        
    } catch(const exception& e) {
        cerr << "❌ Error parsing coin data: " << e.what() << endl;
    }
}

// Fetch historical data for a coin
void fetchHistoricalData(CoinData& coin) {
    cout << "📥 Fetching historical data for " << coin.name << "..." << endl;
    
    // Map of period to days parameter
    map<string, int> periods = {
        {"24h", 1},
        {"7d", 7},
        {"2w", 14},
        {"1m", 30},
        {"3m", 90},
        {"6m", 180},
        {"1y", 365}
    };
    
    for(const auto& [period, days] : periods) {
        string endpoint = "/coins/" + coin.id + "/market_chart?vs_currency=usd&days=" + to_string(days);
        string response = makeAPIRequest(endpoint);
        
        if(response.empty()) {
            cerr << "❌ Failed to fetch " << period << " data for " << coin.name << endl;
            rateLimitSleep();
            continue;
        }
        
        try {
            json data = json::parse(response);
            
            if(data.contains("prices")) {
                vector<pair<long long, double>> priceData;
                
                for(const auto& pricePoint : data["prices"]) {
                    long long timestamp = pricePoint[0].get<long long>();
                    double price = pricePoint[1].get<double>();
                    priceData.push_back({timestamp, price});
                }
                
                // Resample data to match required intervals
                vector<pair<long long, double>> resampledData;
                
                if(period == "24h") {
                    // 288 points (5-minute intervals)
                    int step = max(1, (int)(priceData.size() / 288));
                    for(size_t i = 0; i < priceData.size(); i += step) {
                        if(resampledData.size() >= 288) break;
                        resampledData.push_back(priceData[i]);
                    }
                } else if(period == "7d") {
                    // 168 hourly points
                    int step = max(1, (int)(priceData.size() / 168));
                    for(size_t i = 0; i < priceData.size(); i += step) {
                        if(resampledData.size() >= 168) break;
                        resampledData.push_back(priceData[i]);
                    }
                } else if(period == "2w") {
                    // 84 points (4-hour intervals)
                    int step = max(1, (int)(priceData.size() / 84));
                    for(size_t i = 0; i < priceData.size(); i += step) {
                        if(resampledData.size() >= 84) break;
                        resampledData.push_back(priceData[i]);
                    }
                } else if(period == "1m") {
                    // 30 daily points
                    int step = max(1, (int)(priceData.size() / 30));
                    for(size_t i = 0; i < priceData.size(); i += step) {
                        if(resampledData.size() >= 30) break;
                        resampledData.push_back(priceData[i]);
                    }
                } else if(period == "3m") {
                    // 90 daily points
                    int step = max(1, (int)(priceData.size() / 90));
                    for(size_t i = 0; i < priceData.size(); i += step) {
                        if(resampledData.size() >= 90) break;
                        resampledData.push_back(priceData[i]);
                    }
                } else if(period == "6m") {
                    // 180 daily points
                    int step = max(1, (int)(priceData.size() / 180));
                    for(size_t i = 0; i < priceData.size(); i += step) {
                        if(resampledData.size() >= 180) break;
                        resampledData.push_back(priceData[i]);
                    }
                } else if(period == "1y") {
                    // 52 weekly points
                    int step = max(1, (int)(priceData.size() / 52));
                    for(size_t i = 0; i < priceData.size(); i += step) {
                        if(resampledData.size() >= 52) break;
                        resampledData.push_back(priceData[i]);
                    }
                }
                
                coin.historicalData[period] = resampledData;
                
                cout << "    ✅ " << period << ": " << resampledData.size() << " points" << endl;
            }
            
        } catch(const exception& e) {
            cerr << "❌ Error parsing historical data: " << e.what() << endl;
        }
        
        rateLimitSleep(); // Rate limiting
    }
}

// Fetch global market stats
void fetchGlobalStats() {
    cout << "🌍 Fetching global market stats..." << endl;
    
    string response = makeAPIRequest("/global");
    
    if(response.empty()) {
        cerr << "❌ Failed to fetch global stats" << endl;
        return;
    }
    
    try {
        json data = json::parse(response);
        
        if(data.contains("data")) {
            json stats = data["data"];
            
            lock_guard<mutex> lock(dataMutex);
            globalStats.totalMarketCap = stats["total_market_cap"]["usd"].get<double>();
            globalStats.totalVolume = stats["total_volume"]["usd"].get<double>();
            globalStats.btcDominance = stats.value("market_cap_percentage", json::object()).value("btc", 0.0);
            globalStats.activeCryptocurrencies = stats.value("active_cryptocurrencies", 0);
            globalStats.marketCapChange24h = stats.value("market_cap_change_percentage_24h_usd", 0.0);
            
            cout << "✅ Global stats updated" << endl;
            cout << "    Total Market Cap: $" << (globalStats.totalMarketCap / 1e12) << "T" << endl;
            cout << "    24h Volume: $" << (globalStats.totalVolume / 1e9) << "B" << endl;
            cout << "    BTC Dominance: " << globalStats.btcDominance << "%" << endl;
        }
        
    } catch(const exception& e) {
        cerr << "❌ Error parsing global stats: " << e.what() << endl;
    }
}

// Fetch trending coins
void fetchTrendingCoins() {
    cout << "🔥 Fetching trending coins..." << endl;
    
    string response = makeAPIRequest("/search/trending");
    
    if(response.empty()) {
        cerr << "❌ Failed to fetch trending data" << endl;
        return;
    }
    
    try {
        json data = json::parse(response);
        
        lock_guard<mutex> lock(dataMutex);
        trendingCoins.clear();
        trendingCategories.clear();
        
        // Extract trending coins
        if(data.contains("coins")) {
            for(const auto& item : data["coins"]) {
                if(item.contains("item")) {
                    json coin = item["item"];
                    TrendingCoin tc;
                    tc.id = coin.value("id", "");
                    tc.name = coin.value("name", "");
                    tc.symbol = coin.value("symbol", "");
                    tc.logo = coin.value("thumb", "");
                    tc.rank = coin.value("market_cap_rank", 0);
                    trendingCoins.push_back(tc);
                }
            }
            cout << "✅ Fetched " << trendingCoins.size() << " trending coins" << endl;
        }
        
        // Extract trending categories
        if(data.contains("categories")) {
            vector<string> trends = {"🔥 Trending #1", "📈 Growing fast", "🚀 Popular today", 
                                    "⭐ Hot searches", "💎 Rising interest"};
            int i = 0;
            for(const auto& cat : data["categories"]) {
                TrendingCategory tc;
                tc.name = cat.value("name", "");
                tc.trend = (i < trends.size()) ? trends[i] : "📊 Trending";
                trendingCategories.push_back(tc);
                i++;
                if(i >= 5) break; // Top 5 categories
            }
            cout << "✅ Fetched " << trendingCategories.size() << " trending categories" << endl;
        }
        
    } catch(const exception& e) {
        cerr << "❌ Error parsing trending data: " << e.what() << endl;
    }
}

// Initial data load on startup
void initializeData() {
    cout << "\n🦎 CryptoLizard Server Starting..." << endl;
    cout << "═══════════════════════════════════════════════════════════\n" << endl;
    
    // Phase 1: Fetch top coins list
    cout << "📊 Phase 1: Fetching top " << TOP_COINS_COUNT << " coins..." << endl;
    fetchTopCoins();
    rateLimitSleep();
    
    // Phase 2: Fetch historical data for all coins
    cout << "\n📈 Phase 2: Loading historical data..." << endl;
    cout << "This will take approximately 10 minutes (rate limiting to 30 calls/min)...\n" << endl;
    
    int count = 0;
    int totalCoins;
    {
        lock_guard<mutex> lock(dataMutex);
        totalCoins = topCoins.size();
    }
    
    for(int i = 0; i < totalCoins; i++) {
        count++;
        string coinName;
        {
            lock_guard<mutex> lock(dataMutex);
            coinName = topCoins[i].name;
        }
        cout << "[" << count << "/" << totalCoins << "] " << coinName << "..." << endl;
        
        // Fetch historical data without holding the lock
        CoinData tempCoin;
        {
            lock_guard<mutex> lock(dataMutex);
            tempCoin = topCoins[i];
        }
        
        fetchHistoricalData(tempCoin);
        
        // Update the coin with historical data
        {
            lock_guard<mutex> lock(dataMutex);
            topCoins[i].historicalData = tempCoin.historicalData;
        }
    }
    
    cout << "\n✅ Historical data loaded for all " << TOP_COINS_COUNT << " coins" << endl;
    
    // Phase 3: Fetch trending data
    cout << "\n🔥 Phase 3: Fetching trending coins..." << endl;
    fetchTrendingCoins();
    rateLimitSleep();
    
    // Phase 4: Fetch global stats
    cout << "\n🌍 Phase 4: Fetching global market stats..." << endl;
    fetchGlobalStats();
    
    cout << "\n═══════════════════════════════════════════════════════════" << endl;
    cout << "✅ All data loaded successfully!" << endl;
    cout << "🚀 Server is ready to serve requests" << endl;
    cout << "🔄 Live updates will occur every 5 minutes\n" << endl;
    
    dataReady = true;
}

// Update just the current prices/volumes without touching coin structure
void updateCurrentPrices() {
    cout << "📊 Updating current prices..." << endl;
    
    string endpoint = "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=" + 
                      to_string(TOP_COINS_COUNT) + 
                      "&page=1&sparkline=true&price_change_percentage=24h";
    
    string response = makeAPIRequest(endpoint);
    
    if(response.empty()) {
        cerr << "❌ Failed to fetch price updates" << endl;
        return;
    }
    
    try {
        json data = json::parse(response);
        lock_guard<mutex> lock(dataMutex);
        
        // Update each coin's current data
        for(const auto& apiCoin : data) {
            string coinId = apiCoin.value("id", "");
            
            // Find this coin in our topCoins array
            for(auto& ourCoin : topCoins) {
                if(ourCoin.id == coinId) {
                    // Update ONLY current data, leave historicalData untouched
                    ourCoin.price = apiCoin.value("current_price", ourCoin.price);
                    ourCoin.change24h = apiCoin.value("price_change_percentage_24h", ourCoin.change24h);
                    ourCoin.marketCap = apiCoin.value("market_cap", ourCoin.marketCap);
                    ourCoin.volume24h = apiCoin.value("total_volume", ourCoin.volume24h);
                    ourCoin.rank = apiCoin.value("market_cap_rank", ourCoin.rank);
                    
                    if(apiCoin.contains("sparkline_in_7d") && apiCoin["sparkline_in_7d"].contains("price")) {
                        ourCoin.sparkline7d = apiCoin["sparkline_in_7d"]["price"].get<vector<double>>();
                    }
                    break;
                }
            }
        }
        
        cout << "✅ Prices updated" << endl;
        
    } catch(const exception& e) {
        cerr << "❌ Error updating prices: " << e.what() << endl;
    }
}

// Update live data every 5 minutes
void updateLiveData() {
    // Static counters for different update intervals
    static int updateCounter = 0;
    
    while(true) {
        this_thread::sleep_for(chrono::seconds(UPDATE_INTERVAL));
        
        cout << "\n🔄 [" << chrono::system_clock::to_time_t(chrono::system_clock::now()) 
             << "] 5-minute update starting..." << endl;
        
        // Increment update counter
        updateCounter++;
        
        // Get current timestamp
        long long currentTime = chrono::duration_cast<chrono::milliseconds>(
            chrono::system_clock::now().time_since_epoch()
        ).count();
        
        // Update prices WITHOUT touching the coin structure
        updateCurrentPrices();
        
        // Update historical chart data with new price points (rolling window)
        {
            lock_guard<mutex> lock(dataMutex);
            
            int coinsWithData = 0;
            for(auto& coin : topCoins) {
                if(coin.historicalData.count("24h") > 0) coinsWithData++;
            }
            cout << "📊 Coins with historical data: " << coinsWithData << "/" << topCoins.size() << endl;
            
            for(auto& coin : topCoins) {
                // Add new data point to each chart period
                
                // 24h chart: 288 points (5-minute intervals) - update every time
                if(coin.historicalData.count("24h")) {
                    auto& data24h = coin.historicalData["24h"];
                    data24h.push_back({currentTime, coin.price});
                    // Keep only last 288 points (24 hours at 5-min intervals)
                    if(data24h.size() > 288) {
                        data24h.erase(data24h.begin());
                    }
                }
                
                // 7d chart: 168 points (hourly) - update every 12 updates (1 hour)
                if(updateCounter % 12 == 0) {
                    if(coin.historicalData.count("7d")) {
                        auto& data7d = coin.historicalData["7d"];
                        data7d.push_back({currentTime, coin.price});
                        if(data7d.size() > 168) {
                            data7d.erase(data7d.begin());
                        }
                    }
                }
                
                // 2w chart: 84 points (4-hour intervals) - update every 48 updates (4 hours)
                if(updateCounter % 48 == 0) {
                    if(coin.historicalData.count("2w")) {
                        auto& data2w = coin.historicalData["2w"];
                        data2w.push_back({currentTime, coin.price});
                        if(data2w.size() > 84) {
                            data2w.erase(data2w.begin());
                        }
                    }
                }
                
                // 1m, 3m, 6m charts: daily points - update every 288 updates (1 day)
                if(updateCounter % 288 == 0) {
                    if(coin.historicalData.count("1m")) {
                        auto& data1m = coin.historicalData["1m"];
                        data1m.push_back({currentTime, coin.price});
                        if(data1m.size() > 30) {
                            data1m.erase(data1m.begin());
                        }
                    }
                    
                    if(coin.historicalData.count("3m")) {
                        auto& data3m = coin.historicalData["3m"];
                        data3m.push_back({currentTime, coin.price});
                        if(data3m.size() > 90) {
                            data3m.erase(data3m.begin());
                        }
                    }
                    
                    if(coin.historicalData.count("6m")) {
                        auto& data6m = coin.historicalData["6m"];
                        data6m.push_back({currentTime, coin.price});
                        if(data6m.size() > 180) {
                            data6m.erase(data6m.begin());
                        }
                    }
                }
                
                // 1y chart: 52 points (weekly) - update every 2016 updates (1 week)
                if(updateCounter % 2016 == 0) {
                    if(coin.historicalData.count("1y")) {
                        auto& data1y = coin.historicalData["1y"];
                        data1y.push_back({currentTime, coin.price});
                        if(data1y.size() > 52) {
                            data1y.erase(data1y.begin());
                        }
                    }
                }
            }
        }
        
        cout << "✅ Live update complete (charts updated with new data points)" << endl;
        cout << "📊 Next update in 5 minutes...\n" << endl;
    }
}

// Convert coin data to JSON
json coinToJson(const CoinData& coin, bool includeHistorical = false) {
    json j;
    j["id"] = coin.id;
    j["rank"] = coin.rank;
    j["name"] = coin.name;
    j["symbol"] = coin.symbol;
    j["logo"] = coin.logo;
    j["price"] = coin.price;
    j["change24h"] = coin.change24h;
    j["marketCap"] = coin.marketCap;
    j["volume24h"] = coin.volume24h;
    j["circulatingSupply"] = coin.circulatingSupply;
    j["totalSupply"] = coin.totalSupply;
    j["maxSupply"] = coin.maxSupply;
    j["ath"] = coin.ath;
    j["athChangePercentage"] = coin.athChangePercentage;
    j["athDate"] = coin.athDate;
    j["sparklineData"] = coin.sparkline7d;
    
    if(includeHistorical) {
        json historical;
        for(const auto& [period, data] : coin.historicalData) {
            json periodData = json::array();
            for(const auto& [timestamp, price] : data) {
                periodData.push_back({
                    {"time", timestamp},
                    {"price", price}
                });
            }
            historical[period] = periodData;
        }
        j["historicalData"] = historical;
    }
    
    return j;
}

// Main function
int main() {
    // Initialize CURL
    curl_global_init(CURL_GLOBAL_DEFAULT);
    
    // Start data initialization in background
    thread initThread(initializeData);
    initThread.detach();
    
    // Wait for initial data to be ready before starting update loop
    thread updateThread([&]() {
        while(!dataReady) {
            this_thread::sleep_for(chrono::seconds(1));
        }
        updateLiveData();
    });
    updateThread.detach();
    
    // Create Crow app
    crow::SimpleApp app;
    
    // Enable CORS
    app.loglevel(crow::LogLevel::Warning);
    
    // API Routes
    
    // GET /api/coins - Get all top coins
    CROW_ROUTE(app, "/api/coins")
    ([]{
        if(!dataReady) {
            return crow::response(503, "Server is still loading data...");
        }
        
        lock_guard<mutex> lock(dataMutex);
        json response = json::array();
        
        for(const auto& coin : topCoins) {
            response.push_back(coinToJson(coin, false));
        }
        
        crow::response res(response.dump());
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Content-Type", "application/json");
        return res;
    });
    
    // GET /api/coin/:id - Get detailed coin data
    CROW_ROUTE(app, "/api/coin/<string>")
    ([](const string& coinId){
        if(!dataReady) {
            return crow::response(503, "Server is still loading data...");
        }
        
        lock_guard<mutex> lock(dataMutex);
        
        for(const auto& coin : topCoins) {
            if(coin.id == coinId) {
                json response = coinToJson(coin, true);
                
                crow::response res(response.dump());
                res.add_header("Access-Control-Allow-Origin", "*");
                res.add_header("Content-Type", "application/json");
                return res;
            }
        }
        
        return crow::response(404, "Coin not found");
    });
    
    // GET /api/global - Get global market stats
    CROW_ROUTE(app, "/api/global")
    ([]{
        if(!dataReady) {
            return crow::response(503, "Server is still loading data...");
        }
        
        lock_guard<mutex> lock(dataMutex);
        
        json response;
        response["totalMarketCap"] = globalStats.totalMarketCap;
        response["totalVolume"] = globalStats.totalVolume;
        response["btcDominance"] = globalStats.btcDominance;
        response["activeCryptocurrencies"] = globalStats.activeCryptocurrencies;
        response["marketCapChange24h"] = globalStats.marketCapChange24h;
        
        crow::response res(response.dump());
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Content-Type", "application/json");
        return res;
    });
    
    // GET /api/trending - Get trending coins and categories
    CROW_ROUTE(app, "/api/trending")
    ([]{
        if(!dataReady) {
            return crow::response(503, "Server is still loading data...");
        }
        
        lock_guard<mutex> lock(dataMutex);
        
        json response;
        
        // Trending coins
        json coins = json::array();
        for(const auto& tc : trendingCoins) {
            json coin;
            coin["id"] = tc.id;
            coin["name"] = tc.name;
            coin["symbol"] = tc.symbol;
            coin["logo"] = tc.logo;
            coin["rank"] = tc.rank;
            coins.push_back(coin);
        }
        response["coins"] = coins;
        
        // Trending categories
        json categories = json::array();
        for(const auto& cat : trendingCategories) {
            json c;
            c["name"] = cat.name;
            c["trend"] = cat.trend;
            categories.push_back(c);
        }
        response["categories"] = categories;
        
        crow::response res(response.dump());
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Content-Type", "application/json");
        return res;
    });
    
    // Health check
    CROW_ROUTE(app, "/health")
    ([]{
        json response;
        response["status"] = dataReady ? "ready" : "loading";
        response["coins_loaded"] = topCoins.size();
        
        crow::response res(response.dump());
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Content-Type", "application/json");
        return res;
    });
    
    // Get port from environment variable (for Render) or default to 8080
    const char* port_env = getenv("PORT");
    int port = port_env ? atoi(port_env) : 8080;
    
    // Start server
    cout << "\n🌐 Starting HTTP server on port " << port << "..." << endl;
    app.port(port).multithreaded().run();
    
    // Cleanup
    curl_global_cleanup();
    
    return 0;
}