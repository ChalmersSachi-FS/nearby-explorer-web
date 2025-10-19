# nearby-explorer-web
# Nearby Explorer (Web) — Location-Based Feature Implementation

This project is a web implementation of the "Nearby Explorer" assignment using plain HTML, CSS and JavaScript.

## Features
- Detect device location (Geolocation API)
- Search nearby places using Mapbox Places / Geocoding API
- Interactive map with Mapbox GL JS
- Place details, distance calculation
- Photo capture (mobile camera via file input `capture="environment"`)
- Share location & photos via Web Share API (or fallback to download)
- Loading and error states, caching, manual refresh

## Files
- `index.html` — UI
- `styles.css` — styling
- `app.js` — application logic
- `assets/placeholder.png` — placeholder thumbnail

## Setup (step-by-step)
1. **Install VS Code Live Server** (Ritwick Dey) or run a simple static server:
   - Recommended: Install the Live Server extension in VS Code, open the folder, right-click `index.html` → Open with Live Server.

2. **Get a Mapbox Access Token**
   - Sign up / sign in at https://www.mapbox.com/
   - In your Mapbox account, create/access a token (default public token is OK for this assignment).
   - Copy the token.

3. **Edit `app.js`**
   - Replace `const MAPBOX_ACCESS_TOKEN = 'YOUR_MAPBOX_TOKEN_HERE';` with your token (keep it private—do not push to public repos).

4. **Open the app**
   - Start Live Server and open the page. Allow location permission when prompted.

## Notes on API keys & security
- For a production app, proxy the Mapbox key or keep it on a backend. For this assignment (student project), a public token for development is acceptable.
- If you accidentally expose your token publicly, revoke it in the Mapbox dashboard and generate a new one.

## What to submit
- Source files (`index.html`, `styles.css`, `app.js`)
- A short write up describing tests you ran (manual location tests, manual photo test)
- Screenshots of app running on desktop and mobile (use device emulator if needed)
- Reflection essay (500 words) describing integration challenges

 
