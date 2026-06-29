// server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const METRICS_API_TOKEN = process.env.METRICS_API_TOKEN;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);


//temporary storage (replace with DB later)
let metrics = [];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.sendStatus(204);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    metricCount: metrics.length,
    tokenProtection: Boolean(METRICS_API_TOKEN),
  });
});

//emission estimated using simplified version of Software Carbon Intensity (SCI) specification by Green Software Foundation (GSF)
//simplified formula: CO₂ = Time × Power Draw × Carbon Intensity
//this method does not account for idle time, actual CPU usage or memory load
//assumes one CI runner (not parallel builds)
//uses global average carbon intensity, not actual regional grid mix

// estimate energy (simplified): 0.05 kWh per minute on GitHub-hosted runner

const estimateEmissions = (durationSeconds) => {
  const durationMinutes = durationSeconds / 60;
  const energyKWh = durationMinutes * 0.05; // 0.05 kWh per min
  const carbonFactor = 475; // grams CO2 per kWh (can be region-specific)
  const emissions = energyKWh * carbonFactor;
  return { energyKWh: energyKWh.toFixed(4), co2: emissions.toFixed(2) };
};

// receive POST data from GitHub Action
app.post('/api/green-metrics', (req, res) => {
  console.log(`[metrics] POST /api/green-metrics from ${req.ip}`);

  if (METRICS_API_TOKEN) {
    const authHeader = req.get('Authorization');
    if (authHeader !== `Bearer ${METRICS_API_TOKEN}`) {
      console.warn('[metrics] rejected upload: invalid or missing token');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { repo, branch, commit, duration, runner_type } = req.body;

  if (!repo || !commit || !duration) {
    console.warn('[metrics] rejected upload: missing required fields', req.body);
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { energyKWh, co2 } = estimateEmissions(duration);

  const entry = {
    repo,
    branch,
    commit,
    duration,
    runner_type,
    energy: parseFloat(energyKWh),
    co2: parseFloat(co2),
    timestamp: new Date().toISOString(),
  };

  metrics.push(entry);
  console.log(`[metrics] stored ${repo}@${commit.slice(0, 7)}; total metrics: ${metrics.length}`);
  res.json({ message: 'Data received', data: entry });
});

// return metrics to dashboard
app.get('/api/green-metrics', (req, res) => {
  res.json(metrics.slice(-20)); // return latest 20 entries
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Green Dev Backend running on http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
  console.error(`Failed to start Green Dev Backend: ${error.message}`);
  process.exit(1);
});
