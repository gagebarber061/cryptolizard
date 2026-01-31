// ============================================================================
// CryptoLizard - Real-time Cryptocurrency Data
// Connects to C++ backend server for live CoinGecko data
// ============================================================================

// Configuration
// Auto-detect API URL based on environment
const API_BASE_URL = (() => {
    // If running locally
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8080/api';
    }
    // Production - use your Render backend URL
    // IMPORTANT: Update this with your actual Render backend URL after deployment!
    return 'https://cryptolizard-api.onrender.com/api';
})();

console.log('🦎 API URL:', API_BASE_URL);

const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const COIN_INFO_URL = 'coin-info.json'; // Local JSON file with detailed coin info

// State management
let currentTab = 'market';
let selectedCoin = null;
let currentChart = null;
let allCoinsData = [];
let trendingData = {};
let globalData = {};
let updateTimer = null;
let coinInfoData = {}; // Store coin detailed info

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

// Fetch all coins from backend
async function fetchCoins() {
    try {
        const response = await fetch(`${API_BASE_URL}/coins`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching coins:', error);
        return [];
    }
}

// Fetch detailed coin data including historical charts
async function fetchCoinDetails(coinId) {
    try {
        const response = await fetch(`${API_BASE_URL}/coin/${coinId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching coin details:', error);
        return null;
    }
}

// Fetch global market stats
async function fetchGlobalStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/global`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching global stats:', error);
        return {};
    }
}

// Fetch trending coins and categories
async function fetchTrending() {
    try {
        const response = await fetch(`${API_BASE_URL}/trending`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching trending:', error);
        return { coins: [], categories: [] };
    }
}

// Check server health
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Server health check failed:', error);
        return { status: 'unavailable' };
    }
}

// Load detailed coin information from local JSON
async function loadCoinInfo() {
    try {
        const response = await fetch(COIN_INFO_URL);
        if (response.ok) {
            coinInfoData = await response.json();
            console.log('✅ Coin info data loaded');
        }
    } catch (error) {
        console.warn('⚠️  Could not load coin info data:', error);
        coinInfoData = {};
    }
}

// Get risk level styling
function getRiskLevelStyle(riskLevel) {
    const level = (riskLevel || '').toLowerCase().replace(/\s+/g, '-');
    
    const styles = {
        'low': { color: '#10b981', bg: '#d1fae5', label: 'Low' },
        'medium': { color: '#f59e0b', bg: '#fef3c7', label: 'Medium' },
        'medium-high': { color: '#f97316', bg: '#ffedd5', label: 'Medium-High' },
        'high': { color: '#ef4444', bg: '#fee2e2', label: 'High' },
        'very-high': { color: '#dc2626', bg: '#fecaca', label: 'Very High' }
    };
    
    return styles[level] || styles['medium'];
}

// ============================================================================
// DATA UPDATE FUNCTIONS
// ============================================================================

// Initial data load
async function loadInitialData() {
    console.log('🦎 Loading initial data...');
    showLoading();
    
    // Check if server is ready
    const health = await checkServerHealth();
    
    if (health.status === 'loading') {
        console.log('⏳ Server is still loading data... waiting...');
        document.querySelector('.loading-text').textContent = 'Server is loading cryptocurrency data...';
        
        // Poll until ready
        const pollInterval = setInterval(async () => {
            const h = await checkServerHealth();
            if (h.status === 'ready') {
                clearInterval(pollInterval);
                await loadAllData();
            }
        }, 2000);
        return;
    }
    
    await loadAllData();
}

// Load all data from backend
async function loadAllData() {
    try {
        // Fetch all data in parallel
        const [coins, global, trending] = await Promise.all([
            fetchCoins(),
            fetchGlobalStats(),
            fetchTrending()
        ]);
        
        allCoinsData = coins;
        globalData = global;
        trendingData = trending;
        
        // Render all views
        renderGlobalStats();
        renderCoinList(allCoinsData.slice(0, 20), 'coin-list'); // Top 20 for Market Overview
        renderCoinList(allCoinsData, 'all-coins-list'); // All coins
        renderTopMovers();
        renderTrendingCoins();
        renderTrendingCategories();
        
        console.log('✅ All data loaded successfully!');
        hideLoading();
        
        // Start auto-update timer
        startAutoUpdate();
        
    } catch (error) {
        console.error('Error loading data:', error);
        hideLoading();
        showError('Failed to load cryptocurrency data. Please refresh the page.');
    }
}

// Update live data (every 5 minutes)
async function updateLiveData() {
    console.log('🔄 Updating live data...');
    
    try {
        const coins = await fetchCoins();
        
        if (coins && coins.length > 0) {
            allCoinsData = coins;
            
            // Re-render current view (but not if on detail page)
            if (!selectedCoin) {
                renderCoinList(allCoinsData.slice(0, 20), 'coin-list');
                renderCoinList(allCoinsData, 'all-coins-list');
                renderTopMovers();
            } else {
                // If on detail page, refresh the coin data and update the chart
                const updatedCoin = await fetchCoinDetails(selectedCoin.id);
                if (updatedCoin) {
                    selectedCoin = updatedCoin;
                    
                    // Update price display
                    document.getElementById('detail-price').textContent = `$${formatNumber(updatedCoin.price)}`;
                    
                    const changeClass = updatedCoin.change24h >= 0 ? 'positive' : 'negative';
                    const changeSign = updatedCoin.change24h >= 0 ? '+' : '';
                    const changeElement = document.getElementById('detail-change');
                    changeElement.textContent = `${changeSign}${updatedCoin.change24h.toFixed(2)}%`;
                    changeElement.className = `price-change ${changeClass}`;
                    
                    // Refresh the chart with updated data
                    const activePeriod = document.querySelector('.chart-btn.active');
                    if (activePeriod) {
                        updateChart(updatedCoin, activePeriod.getAttribute('data-period'));
                    }
                    
                    console.log('✅ Detail page updated with new chart data');
                }
            }
            
            console.log('✅ Live data updated');
        }
    } catch (error) {
        console.error('Error updating live data:', error);
    }
}

// Start auto-update timer
function startAutoUpdate() {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
    
    updateTimer = setInterval(updateLiveData, UPDATE_INTERVAL);
    console.log(`🔄 Auto-update started (every ${UPDATE_INTERVAL / 1000 / 60} minutes)`);
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

// Render global market stats
function renderGlobalStats() {
    if (!globalData || Object.keys(globalData).length === 0) return;
    
    const statCards = document.querySelectorAll('.stat-card');
    
    if (statCards.length >= 4) {
        // Total Market Cap
        statCards[0].querySelector('.stat-value').textContent = 
            `$${formatLargeNumber(globalData.totalMarketCap)}`;
        statCards[0].querySelector('.stat-change').textContent = 
            `${globalData.marketCapChange24h >= 0 ? '+' : ''}${globalData.marketCapChange24h.toFixed(1)}%`;
        statCards[0].querySelector('.stat-change').className = 
            `stat-change ${globalData.marketCapChange24h >= 0 ? 'positive' : 'negative'}`;
        
        // 24h Volume
        statCards[1].querySelector('.stat-value').textContent = 
            `$${formatLargeNumber(globalData.totalVolume)}`;
        
        // BTC Dominance
        statCards[2].querySelector('.stat-value').textContent = 
            `${globalData.btcDominance.toFixed(1)}%`;
        
        // Active Cryptocurrencies
        statCards[3].querySelector('.stat-value').textContent = 
            globalData.activeCryptocurrencies.toLocaleString();
    }
}

// Render coin list
function renderCoinList(coins, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';

    coins.forEach(coin => {
        const coinElement = createCoinElement(coin);
        container.appendChild(coinElement);
    });
}

// Create coin list item
function createCoinElement(coin) {
    const div = document.createElement('div');
    div.className = 'coin-item';
    div.onclick = () => showDetailPage(coin.id);

    const changeClass = coin.change24h >= 0 ? 'positive' : 'negative';
    const changeSign = coin.change24h >= 0 ? '+' : '';

    div.innerHTML = `
        <div class="coin-rank">${coin.rank}</div>
        <div class="coin-info">
            <img src="${coin.logo}" alt="${coin.name}" class="coin-logo" onerror="this.src='https://via.placeholder.com/32'">
            <div class="coin-name-group">
                <div class="coin-name">${coin.name}</div>
                <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
            </div>
        </div>
        <div class="coin-price">$${formatNumber(coin.price)}</div>
        <div class="coin-change ${changeClass}">${changeSign}${coin.change24h.toFixed(2)}%</div>
        <div class="coin-marketcap">$${formatLargeNumber(coin.marketCap)}</div>
        <div class="coin-volume">$${formatLargeNumber(coin.volume24h)}</div>
        <div class="sparkline-container">
            ${createSparkline(coin.sparklineData || [], coin.change24h >= 0)}
        </div>
    `;

    return div;
}

// Create sparkline SVG
function createSparkline(data, isPositive) {
    if (!data || data.length === 0) {
        return '<div class="sparkline-empty">—</div>';
    }
    
    const width = 200;
    const height = 50;
    const padding = 2;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * (width - 2 * padding) + padding;
        const y = height - padding - ((value - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');
    
    const color = isPositive ? '#16c784' : '#ea3943';
    
    return `
        <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline
                fill="none"
                stroke="${color}"
                stroke-width="2"
                points="${points}"
            />
        </svg>
    `;
}

// Render top gainers and losers
function renderTopMovers() {
    if (!allCoinsData || allCoinsData.length === 0) return;
    
    const sorted = [...allCoinsData].sort((a, b) => b.change24h - a.change24h);
    const topGainers = sorted.slice(0, 5);
    const topLosers = sorted.slice(-5).reverse();
    
    renderMoversList(topGainers, 'top-gainers');
    renderMoversList(topLosers, 'top-losers');
}

function renderMoversList(coins, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    coins.forEach(coin => {
        const moverItem = document.createElement('div');
        moverItem.className = 'mover-item';
        moverItem.onclick = () => showDetailPage(coin.id);
        
        const changeClass = coin.change24h >= 0 ? 'positive' : 'negative';
        const changeSign = coin.change24h >= 0 ? '+' : '';
        
        moverItem.innerHTML = `
            <img src="${coin.logo}" alt="${coin.name}" class="mover-logo" onerror="this.src='https://via.placeholder.com/32'">
            <div class="mover-info">
                <div class="mover-name">${coin.name}</div>
                <div class="mover-symbol">${coin.symbol.toUpperCase()}</div>
            </div>
            <div class="mover-change ${changeClass}">${changeSign}${coin.change24h.toFixed(2)}%</div>
        `;
        
        container.appendChild(moverItem);
    });
}

// Render trending coins
function renderTrendingCoins() {
    if (!trendingData.coins || trendingData.coins.length === 0) {
        // Fallback to top coins if no trending data
        renderCoinList(allCoinsData.slice(0, 10), 'trending-list');
        return;
    }
    
    // Get full coin data for trending coins
    const trendingCoinsData = trendingData.coins.map(tc => {
        return allCoinsData.find(c => c.id === tc.id);
    }).filter(c => c !== undefined);
    
    renderCoinList(trendingCoinsData, 'trending-list');
}

// Render trending categories
function renderTrendingCategories() {
    const container = document.getElementById('trending-categories');
    if (!container) return;
    
    container.innerHTML = '';
    
    const categories = trendingData.categories || [];
    
    if (categories.length === 0) {
        // Show placeholder if no trending data
        container.innerHTML = '<p class="no-data">Trending categories loading...</p>';
        return;
    }
    
    categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        
        categoryItem.innerHTML = `
            <div class="category-name">${category.name}</div>
            <div class="category-trend">${category.trend}</div>
        `;
        
        container.appendChild(categoryItem);
    });
}

// ============================================================================
// DETAIL PAGE
// ============================================================================

// Show detail page
async function showDetailPage(coinId) {
    showLoading();
    
    try {
        // Fetch detailed coin data with historical charts
        const coin = await fetchCoinDetails(coinId);
        
        if (!coin) {
            throw new Error('Failed to load coin details');
        }
        
        selectedCoin = coin;
        
        // Hide main content
        document.querySelector('.main-content').style.display = 'none';
        
        // Show detail page
        const detailPage = document.getElementById('detail-page');
        detailPage.style.display = 'block';
        
        // Populate detail page
        document.getElementById('detail-logo').src = coin.logo;
        document.getElementById('detail-name').textContent = coin.name;
        document.getElementById('detail-symbol').textContent = coin.symbol.toUpperCase();
        document.getElementById('detail-rank').textContent = `#${coin.rank}`;
        document.getElementById('detail-price').textContent = `$${formatNumber(coin.price)}`;
        
        const changeClass = coin.change24h >= 0 ? 'positive' : 'negative';
        const changeSign = coin.change24h >= 0 ? '+' : '';
        const changeElement = document.getElementById('detail-change');
        changeElement.textContent = `${changeSign}${coin.change24h.toFixed(2)}%`;
        changeElement.className = `price-change ${changeClass}`;
        
        // Stats
        document.getElementById('stat-mcap').textContent = `$${formatLargeNumber(coin.marketCap)}`;
        document.getElementById('stat-volume').textContent = `$${formatLargeNumber(coin.volume24h)}`;
        document.getElementById('stat-supply').textContent = formatLargeNumber(coin.circulatingSupply);
        document.getElementById('stat-total-supply').textContent = coin.totalSupply ? formatLargeNumber(coin.totalSupply) : 'N/A';
        document.getElementById('stat-max-supply').textContent = coin.maxSupply ? formatLargeNumber(coin.maxSupply) : '∞';
        
        // ATH with date and percentage
        const athDate = coin.athDate ? new Date(coin.athDate).toLocaleDateString() : '';
        const athPercent = coin.athChangePercentage ? ` (${coin.athChangePercentage.toFixed(1)}% from ATH)` : '';
        document.getElementById('stat-ath').textContent = `$${formatNumber(coin.ath)}`;
        document.getElementById('stat-ath').title = `${athDate}${athPercent}`;
        
        // Info section - populate from coinInfoData
        const info = coinInfoData[coin.id];
        const infoSection = document.querySelector('.info-section');
        
        if (infoSection) {
            if (info) {
                // Show and populate info section
                infoSection.style.display = 'block';
                
                // Update coin name in heading
                document.getElementById('info-coin-name').textContent = coin.name;
                
                // Creation info
                document.getElementById('info-creator').textContent = info.founder || 'Unknown';
                document.getElementById('info-date').textContent = info.dateFound || 'Unknown';
                
                // Description
                document.getElementById('info-description').textContent = info.description || 'No description available.';
                
                // Major price events
                const eventsList = document.getElementById('info-events');
                eventsList.innerHTML = '';
                if (info.majorPriceEvents && info.majorPriceEvents.length > 0) {
                    info.majorPriceEvents.forEach(event => {
                        const li = document.createElement('li');
                        li.textContent = event;
                        eventsList.appendChild(li);
                    });
                } else {
                    eventsList.innerHTML = '<li>No major events recorded</li>';
                }
                
                // Energy & Mining
                document.getElementById('info-energy').textContent = info.miningEnergyCost || 'N/A';
                document.getElementById('info-mining-cost').textContent = info.miningCostPerCoin || 'N/A';
                document.getElementById('info-mining').textContent = info.miningMethod || 'N/A';
                
                // Transaction mechanism
                document.getElementById('info-transactions').textContent = info.transactionMethod || 'No information available.';
                
                // Risk assessment with color coding
                const riskStyle = getRiskLevelStyle(info.riskLevel || 'Medium');
                const riskBlock = document.querySelector('.info-block.risk-block');
                
                if (riskBlock) {
                    riskBlock.innerHTML = `
                        <h3>⚠️ Risk Assessment</h3>
                        <div class="risk-level-container">
                            <span class="risk-label">Risk Level:</span>
                            <span class="risk-badge" style="background-color: ${riskStyle.bg}; color: ${riskStyle.color}; padding: 6px 14px; border-radius: 6px; font-weight: 600;">
                                ${riskStyle.label}
                            </span>
                        </div>
                        <p style="margin-top: 12px;">${info.riskExplanation || 'Risk assessment not available.'}</p>
                    `;
                }
                
            } else {
                // Hide info section if no data available
                infoSection.style.display = 'none';
            }
        }
        
        // Initialize chart with 24h period
        updateChart(coin, '24h');
        
        hideLoading();
        
        // Scroll to top
        window.scrollTo(0, 0);
        
    } catch (error) {
        console.error('Error showing detail page:', error);
        hideLoading();
        showError('Failed to load coin details. Please try again.');
    }
}

// Hide detail page
function hideDetailPage() {
    document.getElementById('detail-page').style.display = 'none';
    document.querySelector('.main-content').style.display = 'block';
    selectedCoin = null;
    
    // Destroy chart to free memory
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

// ============================================================================
// CHART FUNCTIONS
// ============================================================================

// Update chart with Chart.js
function updateChart(coin, period) {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        return;
    }
    
    // Destroy existing chart if it exists
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    // Get canvas context
    const canvas = document.getElementById('price-chart');
    if (!canvas) {
        console.error('Chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Get historical data for the period
    const historicalData = coin.historicalData && coin.historicalData[period] 
        ? coin.historicalData[period] 
        : null;
    
    if (!historicalData || historicalData.length === 0) {
        console.error('No historical data for period:', period);
        // Show loading message
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chart data loading...', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Prepare data for Chart.js
    const labels = historicalData.map(d => new Date(d.time));
    const prices = historicalData.map(d => d.price);
    
    // Determine if price is up or down
    const isPositive = prices[prices.length - 1] >= prices[0];
    const lineColor = isPositive ? '#16c784' : '#ea3943';
    const gradientColor = isPositive ? 
        'rgba(22, 199, 132, 0.1)' : 
        'rgba(234, 57, 67, 0.1)';
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, gradientColor);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    try {
        // Create chart
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Price',
                    data: prices,
                    borderColor: lineColor,
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: lineColor,
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1a1a1a',
                        bodyColor: '#1a1a1a',
                        borderColor: '#e0e0e0',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                const date = new Date(context[0].parsed.x);
                                return date.toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: period === '24h' || period === '7d' ? 'numeric' : undefined,
                                    minute: period === '24h' || period === '7d' ? '2-digit' : undefined
                                });
                            },
                            label: function(context) {
                                return '$' + formatNumber(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: period === '24h' ? 'hour' : 
                                  period === '7d' ? 'day' :
                                  period === '2w' ? 'day' :
                                  period === '1m' ? 'day' :
                                  period === '3m' ? 'week' :
                                  period === '6m' ? 'month' : 'month',
                            displayFormats: {
                                hour: 'ha',
                                day: 'MMM d',
                                week: 'MMM d',
                                month: 'MMM yyyy'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6c757d',
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        position: 'right',
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: '#6c757d',
                            callback: function(value) {
                                return '$' + formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
        
        console.log(`✅ Chart rendered for ${period} period`);
        
    } catch (error) {
        console.error('Error creating chart:', error);
    }
}

// ============================================================================
// SEARCH FUNCTIONALITY
// ============================================================================

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchDropdown = document.getElementById('search-dropdown');
    
    if (!searchInput || !searchDropdown) return;
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length === 0) {
            searchDropdown.classList.remove('active');
            return;
        }
        
        // Filter coins
        const results = allCoinsData.filter(coin => 
            coin.name.toLowerCase().includes(query) ||
            coin.symbol.toLowerCase().includes(query)
        ).slice(0, 5); // Show top 5 results
        
        // Clear previous results
        searchDropdown.innerHTML = '';
        
        if (results.length === 0) {
            searchDropdown.innerHTML = '<div class="search-no-results">No results found</div>';
            searchDropdown.classList.add('active');
            return;
        }
        
        // Add results
        results.forEach(coin => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.onclick = () => {
                showDetailPage(coin.id);
                searchInput.value = '';
                searchDropdown.classList.remove('active');
            };
            
            resultItem.innerHTML = `
                <img src="${coin.logo}" alt="${coin.name}" class="search-result-logo" onerror="this.src='https://via.placeholder.com/32'">
                <div class="search-result-info">
                    <div class="search-result-name">${coin.name}</div>
                    <div class="search-result-symbol">${coin.symbol.toUpperCase()}</div>
                </div>
            `;
            
            searchDropdown.appendChild(resultItem);
        });
        
        searchDropdown.classList.add('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchDropdown.classList.remove('active');
        }
    });
}

// ============================================================================
// SORT FUNCTIONALITY
// ============================================================================

function setupSort() {
    const customDropdown = document.getElementById('custom-dropdown');
    const dropdownSelected = document.getElementById('dropdown-selected');
    const dropdownOptions = document.getElementById('dropdown-options');
    const options = dropdownOptions.querySelectorAll('.dropdown-option');
    
    // Toggle dropdown
    dropdownSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        customDropdown.classList.toggle('open');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!customDropdown.contains(e.target)) {
            customDropdown.classList.remove('open');
        }
    });
    
    // Handle option selection
    options.forEach(option => {
        option.addEventListener('click', () => {
            const sortType = option.getAttribute('data-value');
            const sortText = option.textContent;
            
            // Update selected text
            dropdownSelected.textContent = sortText;
            
            // Update active state
            options.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            // Close dropdown
            customDropdown.classList.remove('open');
            
            // Sort the coins
            let sortedCoins = [...allCoinsData];
            
            switch(sortType) {
                case 'rank':
                    sortedCoins.sort((a, b) => a.rank - b.rank);
                    break;
                case 'price-high':
                    sortedCoins.sort((a, b) => b.price - a.price);
                    break;
                case 'price-low':
                    sortedCoins.sort((a, b) => a.price - b.price);
                    break;
                case 'change-high':
                    sortedCoins.sort((a, b) => b.change24h - a.change24h);
                    break;
                case 'change-low':
                    sortedCoins.sort((a, b) => a.change24h - b.change24h);
                    break;
                case 'volume-high':
                    sortedCoins.sort((a, b) => b.volume24h - a.volume24h);
                    break;
                case 'volume-low':
                    sortedCoins.sort((a, b) => a.volume24h - b.volume24h);
                    break;
            }
            
            renderCoinList(sortedCoins, 'all-coins-list');
        });
    });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            
            // If on detail page, go back first
            if (selectedCoin) {
                hideDetailPage();
            }
            
            switchTab(tab);
        });
    });

    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
        hideDetailPage();
    });

    // Chart period buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateChart(selectedCoin, btn.getAttribute('data-period'));
        });
    });
}

// Tab switching
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatNumber(num) {
    if (num >= 1) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    }
}

function formatLargeNumber(num) {
    if (num >= 1e12) {
        return (num / 1e12).toFixed(2) + 'T';
    } else if (num >= 1e9) {
        return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
        return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

// Loading state functions
function showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

// Error handling
function showError(message) {
    // You can implement a toast notification or modal here
    alert(message);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🦎 CryptoLizard initializing...');
    
    // Setup event listeners
    setupEventListeners();
    setupSearch();
    setupSort();
    
    // Load coin info data
    loadCoinInfo();
    
    // Load initial data
    loadInitialData();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
});
