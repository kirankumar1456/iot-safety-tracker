# IoT Safety Tracker

An IoT safety tracking dashboard and telemetry backend with real-time GPS tracking, accelerometer motion sensing, SOS alerting, and device management.

---

## Features

- **Live GPS Tracking**: Interactive Leaflet map with real-time tracker location pins.
- **Motion & Telemetry Sensor**: 3-axis accelerometer visualization (MPU6050) and battery monitoring.
- **Safety Alerts**: Instant SOS triggers and resolution workflow.
- **REST API**: Flask backend providing endpoints for trackers, telemetry, and alerts.
- **Vercel Serverless Ready**: Native deployment on Vercel with zero-configuration setup and automatic database seeding.

---

## Tech Stack

- **Backend**: Python / Flask / SQLAlchemy
- **Frontend**: Vanilla JavaScript / HTML5 / CSS3 / Leaflet.js
- **Deployment**: Vercel Serverless Functions (`api/index.py` + edge static routing)
- **Database**: SQLite (local / `/tmp` on Vercel) or external PostgreSQL (via `DATABASE_URL`)

---

## Deploying to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "Initial commit for Vercel deployment"
git branch -M main
git remote add origin https://github.com/kirankumar1456/iot-safety-tracker.git
git push -u origin main
```

### 2. Import into Vercel
1. Go to [vercel.com/new](https://vercel.com/new).
2. Connect your GitHub account and select **`iot-safety-tracker`**.
3. Keep default settings (Vercel automatically detects `vercel.json` and `api/index.py`).
4. Click **Deploy**.

### 3. Optional: Persistent Database (Supabase / Neon / PostgreSQL)
By default, the app initializes a local database in `/tmp` with sample data. To connect a persistent cloud database:
1. In your Vercel Project Dashboard, navigate to **Settings** > **Environment Variables**.
2. Add `DATABASE_URL` with your PostgreSQL connection string (e.g. from Neon or Supabase).
3. Redeploy the project.

---

## Local Development

```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
python run.py
```

Dashboard will be accessible at: `http://localhost:5001`
