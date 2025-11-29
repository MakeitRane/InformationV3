# Vercel Deployment Troubleshooting

## Current Issue: 404 Error

If you're getting a 404 error, check the following:

### 1. Root Directory Setting in Vercel

**CRITICAL**: In your Vercel project settings, make sure:
- **Root Directory** is set to: `backend`
- This tells Vercel that the project root is the `backend/` folder

### 2. Verify File Structure

From Vercel's perspective (after setting Root Directory to `backend`), the structure should be:
```
backend/              <- Vercel sees this as root
├── api/
│   └── index.js     <- Serverless function
├── server.js         <- Express app
├── vercel.json       <- Configuration
└── package.json
```

### 3. Check Vercel Logs

1. Go to your Vercel dashboard
2. Click on your project
3. Go to the "Deployments" tab
4. Click on the latest deployment
5. Check the "Functions" tab to see if `api/index.js` is listed
6. Check the "Logs" tab for any errors

### 4. Test the Function Directly

Try accessing:
- `https://v3-information.vercel.app/api/index.js` (should show function info or error)
- `https://v3-information.vercel.app/` (should show root route)
- `https://v3-information.vercel.app/api/conversations` (should show API response)

### 5. Alternative: Remove vercel.json

If the current setup doesn't work, try:
1. Delete `vercel.json`
2. Vercel should auto-detect the `api/` folder
3. Redeploy

### 6. Check Environment Variables

Make sure `GEMINI_API_KEY` is set in Vercel project settings.

