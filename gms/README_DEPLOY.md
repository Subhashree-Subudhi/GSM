# Deploy GMS (Server + Client)

## Option A: Render (recommended)
1. Push this repo to GitHub.
2. In Render, click New -> Blueprint, connect your repo.
3. Render will read `render.yaml` and create a Web Service (Docker).
4. First deploy builds the client and server, then runs on port 8080.
5. After deploy is live, open the generated `onrender.com` URL.

Notes:
- Health check: `/api/health`
- Change plan/region in `render.yaml` if desired.

## Option B: Railway
1. Push repo to GitHub.
2. In Railway, create a new project from the repo.
3. Build command: `npm run build` (root).
4. Start command: `npm start` (root) or use the provided `Procfile`.
5. Expose port 8080. Railway will assign a persistent domain.

## Option C: Docker anywhere
```bash
# Build
docker build -t gms:latest .
# Run
docker run -p 8080:8080 -e PORT=8080 gms:latest
```
Then open http://localhost:8080