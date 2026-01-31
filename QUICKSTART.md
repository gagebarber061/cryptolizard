# ⚡ QUICK START - Get Online in 10 Minutes

## 1️⃣ Upload to GitHub

```bash
cd cryptolizard-deploy
git init
git add .
git commit -m "Deploy CryptoLizard"

# Create new repo on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/cryptolizard.git
git branch -M main
git push -u origin main
```

## 2️⃣ Deploy on Render

1. Go to https://dashboard.render.com/
2. Click "New +" → "Blueprint"
3. Connect your GitHub repo
4. Click "Apply"
5. Wait 5-10 minutes ☕

## 3️⃣ Get Your URLs

You'll get TWO URLs:
- **API:** `https://cryptolizard-api.onrender.com`
- **Website:** `https://cryptolizard-frontend.onrender.com`

## 4️⃣ Update API URL

Edit `frontend/script.js` line 9:

```javascript
return 'https://cryptolizard-api.onrender.com/api';
// ↑ Change to YOUR actual backend URL
```

Then:
```bash
git add frontend/script.js
git commit -m "Update API URL"
git push
```

## 5️⃣ DONE! 🎉

Visit your frontend URL and you're LIVE!

Test it:
```bash
curl https://cryptolizard-api.onrender.com/health
```

Should see:
```json
{"status":"ready","coins_loaded":50}
```

---

**That's it!** Your crypto tracker is online! 🦎🚀

**First time?** Backend takes 2-3 minutes to load data on startup.

**Need help?** Read the full README.md

**Want it faster?** Upgrade backend to $7/mo (frontend stays FREE)
