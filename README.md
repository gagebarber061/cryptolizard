# 🦎 CryptoLizard - Complete Deployment Guide

## 📦 What's Included

This package contains EVERYTHING you need to deploy CryptoLizard to Render:

```
cryptolizard-deploy/
├── backend/
│   ├── Dockerfile          ← Backend container config
│   ├── crypto_server.cpp   ← C++ server (UPDATED with PORT support)
│   ├── CMakeLists.txt      ← Build configuration
│   └── .dockerignore       ← Docker optimization
├── frontend/
│   ├── index.html          ← Main page
│   ├── script.js           ← JavaScript (UPDATED for production)
│   ├── styles.css          ← Styling
│   ├── lizardcolor.png     ← Logo
│   ├── lizardblackandwhite.png
│   └── coingecko-attribution.png
└── render.yaml             ← Deploy BOTH services with one click!
```

---

## 🚀 DEPLOYMENT STEPS (Copy/Paste This!)

### Step 1: Upload to GitHub

```bash
# Navigate to your folder
cd cryptolizard-deploy

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial CryptoLizard deployment"

# Create repo on GitHub (go to github.com → New Repository)
# Then connect and push:
git remote add origin https://github.com/YOUR-USERNAME/cryptolizard.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [https://dashboard.render.com/](https://dashboard.render.com/)
2. Sign in (or create account - it's free!)
3. Click **"New +"** → **"Blueprint"**
4. Click **"Connect GitHub"** and authorize Render
5. Select your `cryptolizard` repository
6. Click **"Apply"**
7. ⏳ Wait 5-10 minutes for deployment

### Step 3: Get Your URLs

After deployment completes, you'll see TWO services:

**Backend API:**
```
https://cryptolizard-api.onrender.com
```

**Frontend Website:**
```
https://cryptolizard-frontend.onrender.com
```

### Step 4: Update Frontend API URL

**IMPORTANT:** Update `frontend/script.js` line 9:

```javascript
// Change this line:
return 'https://cryptolizard-api.onrender.com/api';

// To YOUR actual backend URL (you'll get this from Render)
return 'https://YOUR-ACTUAL-API-URL.onrender.com/api';
```

Then commit and push:
```bash
git add frontend/script.js
git commit -m "Update API URL"
git push
```

Render will auto-deploy the update! 🎉

---

## ✅ Testing Your Deployment

### Test 1: Backend Health Check
```bash
curl https://cryptolizard-api.onrender.com/health
```

Expected response:
```json
{"status":"ready","coins_loaded":50}
```

If you see `"status":"loading"`, wait 2-3 minutes.

### Test 2: Backend API
```bash
curl https://cryptolizard-api.onrender.com/api/coins
```

Should return JSON array of 50 coins.

### Test 3: Frontend
Visit: `https://cryptolizard-frontend.onrender.com`

You should see your crypto tracker with live data!

### Test 4: Full Integration
Open browser console on frontend and run:
```javascript
fetch('https://cryptolizard-api.onrender.com/api/coins')
  .then(r => r.json())
  .then(console.log)
```

Should display coins data!

---

## 🎯 What Each Service Does

### Backend (cryptolizard-api)
- **Tech:** C++ server with Crow framework
- **Port:** Dynamic (set by Render)
- **Endpoints:**
  - `/health` - Health check
  - `/api/coins` - All top 50 coins
  - `/api/coin/:id` - Detailed coin data with charts
  - `/api/global` - Market statistics
  - `/api/trending` - Trending coins
- **Updates:** Every 5 minutes automatically
- **Free Tier:** Sleeps after 15 min inactivity

### Frontend (cryptolizard-frontend)
- **Tech:** HTML/CSS/JavaScript
- **Framework:** Vanilla JS + Chart.js
- **Features:**
  - Market overview
  - All coins list
  - Trending page
  - Detailed coin pages with charts
  - Search functionality
- **Free Tier:** ALWAYS ON (never sleeps!)

---

## ⚙️ How It Works

1. **First visit:**
   - Frontend loads instantly (static site)
   - Backend wakes up (30-60 seconds on free tier)
   - Shows "Loading..." until backend is ready
   - Fetches all data and displays

2. **Subsequent visits:**
   - If within 15 minutes: instant!
   - If after 15 minutes: 30-60 second wake-up

3. **Auto-updates:**
   - Backend fetches new data every 5 minutes
   - Frontend refreshes display every 5 minutes
   - Charts update with real-time data

---

## 💰 Costs

**FREE FOREVER:**
- Backend: Free tier (with sleep)
- Frontend: Free tier (always on)

**Optional Upgrade ($7/month):**
- Backend → Starter tier
- Benefits:
  - NO sleep (always instant)
  - 512MB RAM
  - Better performance
- Frontend stays FREE

---

## 🐛 Troubleshooting

### Problem: "Failed to fetch"
**Solution:** Check that backend URL in `script.js` matches your actual Render URL

### Problem: 503 errors
**Solution:** Backend is loading data. Wait 2-3 minutes, then refresh.

### Problem: CORS errors
**Solution:** Backend has CORS enabled. Check browser console for exact error.

### Problem: Backend won't start
**Solution:** 
1. Check Render logs (click on backend service → Logs tab)
2. Look for build errors
3. Ensure all files were uploaded to GitHub

### Problem: "Server is loading data..."
**Solution:** This is NORMAL on first startup. Wait 2-3 minutes for initial data load.

### Problem: Chart not showing
**Solution:** Click on a coin to view details. Charts load on the detail page.

---

## 📊 API Endpoints Reference

### GET /health
```json
{
  "status": "ready",
  "coins_loaded": 50
}
```

### GET /api/coins
Returns array of 50 coins with current data

### GET /api/coin/:id
Example: `/api/coin/bitcoin`
Returns detailed coin data with historical charts (24h, 7d, 1m, 3m, 6m, 1y)

### GET /api/global
```json
{
  "totalMarketCap": 2100000000000,
  "totalVolume": 89200000000,
  "btcDominance": 51.3,
  "activeCryptocurrencies": 12847,
  "marketCapChange24h": 2.4
}
```

### GET /api/trending
```json
{
  "coins": [...],
  "categories": [...]
}
```

---

## 🔄 Making Updates

After deployment, any changes you push to GitHub will auto-deploy:

```bash
# Make your changes
git add .
git commit -m "Your update message"
git push

# Render auto-deploys in ~3-5 minutes!
```

---

## 🎨 Customization Ideas

- Change colors in `styles.css`
- Add more coins in `crypto_server.cpp` (change TOP_COINS_COUNT)
- Add custom features in `script.js`
- Modify chart styles
- Add dark mode

---

## 📝 Important Notes

1. **API Key:** The backend uses a CoinGecko demo API key. It has rate limits (30 calls/min).
2. **Data Updates:** Backend updates every 5 minutes to respect rate limits.
3. **First Load:** Takes 2-3 minutes to fetch all historical data on first startup.
4. **Free Tier Sleep:** Backend sleeps after 15 min of inactivity on free tier.
5. **Frontend:** Always instant, never sleeps!

---

## 🆘 Getting Help

1. **Check Render Logs:** 
   - Dashboard → Your Service → Logs tab
   - Look for errors or warnings

2. **Test Endpoints:**
   ```bash
   curl https://YOUR-BACKEND.onrender.com/health
   curl https://YOUR-BACKEND.onrender.com/api/coins
   ```

3. **Browser Console:**
   - Open DevTools (F12)
   - Check Console tab for JavaScript errors
   - Check Network tab for failed requests

---

## ✨ You're All Set!

Your crypto tracker is now live on the internet! 🎉

- **Backend:** Fetching real-time data from CoinGecko
- **Frontend:** Beautiful UI showing live prices
- **Charts:** Interactive historical data
- **Search:** Find any coin instantly
- **Trending:** See what's hot

Share your live URL with friends! 🦎🚀

---

**Need to update the API URL?** Just edit `frontend/script.js`, commit, and push!
**Want to upgrade?** Click "Upgrade" in Render dashboard for $7/mo (backend only, frontend always free)
**Questions?** Check the logs in Render dashboard!
