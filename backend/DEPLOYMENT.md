# Vercel Backend Deployment Guide

This guide walks you through deploying your backend to Vercel.

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
2. **Copy this URL** - this is your backend API URL
3. Test it by visiting: `https://your-project-name.vercel.app/api/conversations`
   - You should get a response (even if it's an error, that means the server is running)

### Step 4: Update Frontend to Use Vercel Backend

1. **Update frontend API configuration**:
   - Open `frontend/src/api.js` (or wherever you set `API_URL`)
   - Change from:
     ```js
     const API_URL = 'http://localhost:3001/api';
     ```
   - To:
     ```js
     const API_URL = 'https://your-project-name.vercel.app/api';
     ```
   - Or use an environment variable:
     ```js
     const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
     ```
   - Then set `REACT_APP_API_URL` in your frontend's deployment environment

### Step 5: Test the Deployment

1. **Test backend directly**: `https://your-backend.vercel.app/api/test-gemini`
2. **Test from frontend**: Make a request through your React app

## Troubleshooting

### Backend returns 404 on Vercel

- Make sure `vercel.json` is in the `backend/` directory
- Check that Root Directory in Vercel is set to `backend`
- Verify `api/index.js` exists and exports the app correctly

### CORS errors

- Ensure CORS is configured in your backend (should already be set with `app.use(cors())`)
- Check that your frontend domain is allowed in CORS settings if you have specific origins configured

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
Vercel Backend (Serverless Functions)
    ↓
Gemini API
```

