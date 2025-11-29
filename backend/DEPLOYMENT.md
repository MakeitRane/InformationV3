# Vercel Backend Deployment Guide

This guide walks you through deploying your backend to Vercel and connecting it to the Cloudflare rate limiter.

## What Was Changed

1. **`server.js`**: Modified to export the Express app for Vercel while still supporting local development
2. **`api/index.js`**: Created as the Vercel serverless function entry point
3. **`vercel.json`**: Added configuration for Vercel to route `/api/*` requests correctly

## Step-by-Step Deployment Instructions

### Step 1: Push Your Code to GitHub

Make sure all changes are committed and pushed:

```bash
git add backend/
git commit -m "Configure backend for Vercel deployment"
git push
```

### Step 2: Deploy Backend to Vercel

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. Click **"New Project"** or **"Add New..." → "Project"**
3. **Import your Git repository**:
   - Select your GitHub repository
   - Click **"Import"**
4. **Configure the project**:
   - **Framework Preset**: Select **"Other"** (or leave as auto-detected)
   - **Root Directory**: Set to **`backend`** (important!)
   - **Build Command**: Leave empty (Vercel will auto-detect)
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install` (should be auto-detected)
5. **Environment Variables**:
   - Click **"Environment Variables"**
   - Add the following:
     - **Name**: `GEMINI_API_KEY`
     - **Value**: Your actual Gemini API key
     - **Environment**: Select all (Production, Preview, Development)
   - Add any other environment variables your backend needs
6. **Deploy**:
   - Click **"Deploy"**
   - Wait for deployment to complete (usually 1-2 minutes)

### Step 3: Get Your Backend URL

After deployment completes:

1. You'll see a deployment URL like: `https://your-project-name.vercel.app`
2. **Copy this URL** - this is your `BACKEND_ORIGIN`
3. Test it by visiting: `https://your-project-name.vercel.app/api/conversations`
   - You should get a response (even if it's an error, that means the server is running)

### Step 4: Update Cloudflare Worker Configuration

1. **Open** `cloudflare-rate-limiter/wrangler.toml`
2. **Update** the `BACKEND_ORIGIN` variable:

```toml
[vars]
BACKEND_ORIGIN = "https://your-project-name.vercel.app"
```

Replace `your-project-name.vercel.app` with your actual Vercel URL (no trailing slash).

3. **Deploy the Cloudflare Worker**:

```bash
cd cloudflare-rate-limiter
wrangler deploy
```

### Step 5: Update Frontend to Use Cloudflare Worker

1. **Get your Cloudflare Worker URL**:
   - After deploying, you'll get a URL like: `https://chat-gpt-tree-rate-limiter.your-subdomain.workers.dev`
   - Or if you set up a custom domain: `https://api.yourdomain.com`

2. **Update frontend API configuration**:
   - Open `frontend/src/api.js` (or wherever you set `API_URL`)
   - Change from:
     ```js
     const API_URL = 'http://localhost:3001/api';
     ```
   - To:
     ```js
     const API_URL = 'https://your-worker-url.workers.dev/api';
     ```
   - Or use an environment variable:
     ```js
     const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
     ```
   - Then set `REACT_APP_API_URL` in your frontend's deployment environment

### Step 6: Test the Full Flow

1. **Test backend directly**: `https://your-backend.vercel.app/api/test-gemini`
2. **Test through rate limiter**: `https://your-worker.workers.dev/api/test-gemini`
3. **Test from frontend**: Make a request through your React app

## Troubleshooting

### Backend returns 404 on Vercel

- Make sure `vercel.json` is in the `backend/` directory
- Check that Root Directory in Vercel is set to `backend`
- Verify `api/index.js` exists and exports the app correctly

### Rate limiter can't reach backend

- Verify `BACKEND_ORIGIN` in `wrangler.toml` has no trailing slash
- Check that your Vercel backend URL is correct
- Ensure CORS is configured in your backend (should already be set with `app.use(cors())`)

### Environment variables not working

- Make sure `GEMINI_API_KEY` is set in Vercel project settings
- Redeploy after adding environment variables
- Check Vercel logs for errors

## Local Development

Your backend still works locally! Just run:

```bash
cd backend
npm install
npm start
```

The server will start on `http://localhost:3001` as before.

## Architecture Overview

```
Frontend (Browser)
    ↓
Cloudflare Worker (Rate Limiter)
    ↓
Vercel Backend (Serverless Functions)
    ↓
Gemini API
```

All requests flow through the rate limiter, which enforces:
- 3 requests per second per IP
- 100 requests per calendar day (EST) per IP

