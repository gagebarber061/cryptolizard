# 🔧 Troubleshooting Cheat Sheet

## ❌ Common Problems & Solutions

### 1. "Failed to fetch" or Network Error

**Cause:** Frontend can't reach backend

**Fix:**
```javascript
// In frontend/script.js, line 9:
return 'https://YOUR-ACTUAL-BACKEND-URL.onrender.com/api';
```

Make sure URL matches your Render backend URL!

---

### 2. Backend shows "Service Unavailable" (503)

**Cause:** Backend is still loading initial data

**Fix:** Wait 2-3 minutes. Check health endpoint:
```bash
curl https://your-backend.onrender.com/health
```

If status is "loading", wait. If "ready", you're good!

---

### 3. Backend won't start / Build failed

**Cause:** Missing files or Docker error

**Fix:**
1. Go to Render Dashboard → Your Service → Logs
2. Look for error messages
3. Common issues:
   - Missing CMakeLists.txt
   - Wrong Dockerfile path in render.yaml
   - Git didn't upload all files

**Solution:** Re-push all files:
```bash
git add .
git commit -m "Fix deployment"
git push
```

---

### 4. First request takes 30+ seconds

**Cause:** Free tier cold start

**Fix:** This is NORMAL! 

Options:
- Just wait (it's free!)
- Upgrade to $7/mo Starter plan (instant)
- Keep it warm with a cron ping service

---

### 5. "Server is loading data..." message

**Cause:** Backend is fetching historical data from CoinGecko

**Fix:** This is NORMAL on first startup! Wait 2-3 minutes.

The backend needs to:
- Fetch top 50 coins (1 request)
- Fetch historical data for each coin (50 requests)
- Takes time due to rate limits (30 calls/min)

---

### 6. Charts not showing

**Cause:** Need to click on a coin first

**Fix:** Charts only appear on coin detail pages. Click any coin!

---

### 7. CORS Error in Browser Console

**Cause:** Wrong API URL or protocol mismatch

**Fix:**
- Make sure using `https://` not `http://`
- Check API URL in script.js
- Backend already has CORS enabled

---

### 8. Data not updating

**Cause:** Auto-update might have stopped

**Fix:** Refresh the page. Check browser console for errors.

---

### 9. Images not loading

**Cause:** Missing image files

**Fix:** Make sure these are in `frontend/`:
- lizardcolor.png
- lizardblackandwhite.png
- coingecko-attribution.png

---

### 10. Render deployment stuck

**Cause:** Long build time or error

**Fix:**
1. Check Render logs
2. Docker builds take 5-8 minutes (normal!)
3. If stuck >15 min, cancel and redeploy

---

## 🔍 How to Debug

### Check Backend Logs
```
Render Dashboard → cryptolizard-api → Logs
```

Look for:
- ✅ "Starting HTTP server on port..."
- ✅ "Fetching top 50 coins..."
- ✅ "Initialization complete!"
- ❌ Any error messages

### Check Frontend in Browser
```
F12 → Console tab
```

Look for:
- ✅ "🦎 CryptoLizard initializing..."
- ✅ "All data loaded successfully!"
- ❌ Network errors
- ❌ JavaScript errors

### Test Backend Directly
```bash
# Health check
curl https://your-backend.onrender.com/health

# Get coins
curl https://your-backend.onrender.com/api/coins

# Get specific coin
curl https://your-backend.onrender.com/api/coin/bitcoin
```

---

## 📞 Quick Checks

**Is backend running?**
```bash
curl https://your-backend.onrender.com/health
```

**Is frontend accessible?**
```
Open: https://your-frontend.onrender.com
```

**Is API URL correct?**
```
Check frontend/script.js line 9
```

**Are all files on GitHub?**
```bash
git status
git add .
git push
```

---

## 🆘 Still Stuck?

1. **Re-read README.md** - Most answers are there!
2. **Check Render logs** - They're super helpful
3. **Test endpoints with curl** - Isolate the problem
4. **Start fresh** - Sometimes easiest to redeploy

---

## ✅ Everything Working Checklist

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully  
- [ ] `/health` returns `{"status":"ready"}`
- [ ] `/api/coins` returns JSON array
- [ ] Frontend loads and shows coins
- [ ] Can click a coin and see chart
- [ ] Search works
- [ ] No console errors

If all checked, you're GOLDEN! 🎉
