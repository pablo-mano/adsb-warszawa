# Deploying ADS-B Warszawa to Vercel Hobby

This guide explains how to deploy the ADS-B Warszawa application to Vercel Hobby tier.

## Prerequisites

- GitHub repository: https://github.com/pablo-mano/adsb-warszawa
- Vercel account (free Hobby tier)

## Option 1: Deploy via Vercel Dashboard (Recommended)

This is the easiest method and provides automatic deployments on every push.

1. **Go to Vercel**: Visit https://vercel.com
2. **Sign in**: Log in with your GitHub account
3. **Import Project**: Click "Add New..." → "Project"
4. **Import Git Repository**: 
   - Select "Import Git Repository"
   - Choose `pablo-mano/adsb-warszawa` from the list
   - If not visible, click "Adjust GitHub App Permissions" to grant access
5. **Configure Project**:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install --legacy-peer-deps`
     - ⚠️ **IMPORTANT**: Override the install command to include `--legacy-peer-deps`
     - Click "Override" next to "Install Command"
     - Enter: `npm install --legacy-peer-deps`
6. **Environment Variables**: None required (app uses public APIs)
7. **Deploy**: Click "Deploy"

After deployment completes (2-3 minutes), you'll receive a production URL like:
- `https://adsb-warszawa.vercel.app` or
- `https://adsb-warszawa-{random}.vercel.app`

### Automatic Deployments

Once connected, Vercel will automatically:
- Deploy production builds from the `main` branch
- Create preview deployments for pull requests
- Run build checks on every commit

## Option 2: Deploy via Vercel CLI

If you prefer using the command line:

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from project directory**:
   ```bash
   cd /path/to/adsb-warszawa
   vercel --prod
   ```

4. **Follow the prompts**:
   - Set up and deploy? Yes
   - Which scope? (Select your account)
   - Link to existing project? No
   - What's your project's name? `adsb-warszawa`
   - In which directory is your code located? `./`
   - Want to override the settings? Yes (for install command)
   - Override Install Command: `npm install --legacy-peer-deps`

The CLI will build and deploy your application, providing a production URL.

## Option 3: GitHub Integration (Automatic)

If you've previously connected your GitHub account to Vercel:

1. Merge the PR to `main` branch
2. Vercel will automatically detect the new Next.js project
3. You'll receive an email with deployment details
4. Check your Vercel dashboard for the production URL

## Build Configuration

The application is already configured for Vercel with:
- ✅ Next.js 15 with App Router
- ✅ TypeScript compilation
- ✅ Tailwind CSS processing
- ✅ Optimized production build
- ✅ API routes with proper caching
- ✅ Static and dynamic rendering

## Important Notes

### Install Command Override
You **must** use `--legacy-peer-deps` during npm install because:
- The app uses React 19 (latest)
- react-leaflet@4.2.1 requires React 18 as peer dependency
- The libraries are compatible, but npm needs the flag to proceed

### No Environment Variables Required
- The application uses public ADS-B APIs
- No authentication or API keys needed
- No database configuration required

### Rate Limiting
The server-side API proxy handles rate limiting (1 req/s) automatically, so no additional configuration is needed.

## Verifying Deployment

After deployment, verify the application:

1. **Map loads correctly** with OpenStreetMap tiles
2. **Aircraft data appears** within a few seconds
3. **List shows aircraft** in the left panel
4. **Clicking aircraft** shows details in right panel
5. **Map markers** display airplane icons with correct rotation
6. **Attribution link** to adsb.fi is visible in footer

## Troubleshooting

### Build fails with peer dependency error
- Make sure the install command includes `--legacy-peer-deps`
- In Vercel dashboard, go to Project Settings → General → Build & Development Settings
- Override Install Command: `npm install --legacy-peer-deps`

### Map doesn't load
- Check browser console for errors
- Verify OpenStreetMap tiles are loading (network tab)
- Leaflet CSS should be loaded from CDN

### No aircraft data
- Check `/api/aircraft` endpoint in browser network tab
- API may be rate-limited or temporarily unavailable
- Try again after a few seconds

### TypeScript errors
- The build uses strict mode
- All types are properly defined
- If issues occur, check `tsconfig.json` matches the repository

## Production URL

Once deployed, your production URL will be:
- Custom domain: `https://adsb-warszawa.vercel.app` (if available)
- Auto-generated: `https://adsb-warszawa-{random}.vercel.app`

You can customize the domain in Vercel dashboard under Project Settings → Domains.

## Support

For Vercel-specific issues:
- Vercel Documentation: https://vercel.com/docs
- Vercel Support: https://vercel.com/support

For application issues:
- GitHub Issues: https://github.com/pablo-mano/adsb-warszawa/issues
