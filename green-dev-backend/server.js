// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const METRICS_API_TOKEN = process.env.METRICS_API_TOKEN;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/green-metrics.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    branch TEXT,
    commit_hash TEXT NOT NULL,
    duration INTEGER NOT NULL,
    runner_type TEXT,
    metric_type TEXT NOT NULL DEFAULT 'ci_build',
    step_name TEXT,
    phase TEXT,
    energy REAL NOT NULL,
    co2 REAL NOT NULL,
    timestamp TEXT NOT NULL
  )
`);

const metricColumns = db.prepare('PRAGMA table_info(metrics)').all().map((column) => column.name);
if (!metricColumns.includes('metric_type')) {
  db.exec("ALTER TABLE metrics ADD COLUMN metric_type TEXT NOT NULL DEFAULT 'ci_build'");
}
if (!metricColumns.includes('step_name')) {
  db.exec('ALTER TABLE metrics ADD COLUMN step_name TEXT');
}
if (!metricColumns.includes('phase')) {
  db.exec('ALTER TABLE metrics ADD COLUMN phase TEXT');
}

const getMetricCount = () => db.prepare('SELECT COUNT(*) AS count FROM metrics').get().count;

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
    metricCount: getMetricCount(),
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

  const {
    repo,
    branch,
    commit,
    duration,
    runner_type,
    metric_type = 'ci_build',
    step_name = null,
    phase = null,
  } = req.body;

  const durationSeconds = Number(duration);

  if (!repo || !commit || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
    console.warn('[metrics] rejected upload: missing required fields', req.body);
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { energyKWh, co2 } = estimateEmissions(durationSeconds);

  const entry = {
    repo,
    branch,
    commit,
    duration: durationSeconds,
    runner_type,
    metric_type,
    step_name,
    phase,
    energy: parseFloat(energyKWh),
    co2: parseFloat(co2),
    timestamp: new Date().toISOString(),
  };

  db.prepare(`
  INSERT INTO metrics (
    repo, branch, commit_hash, duration, runner_type, metric_type, step_name, phase, energy, co2, timestamp
  )
  VALUES (
    @repo, @branch, @commit, @duration, @runner_type, @metric_type, @step_name, @phase, @energy, @co2, @timestamp
  )
`).run(entry);

  const metricLabel = step_name ? `${metric_type}/${step_name}` : metric_type;
  console.log(`[metrics] stored ${metricLabel} ${repo}@${commit.slice(0, 7)}; total metrics: ${getMetricCount()}`);
  res.json({ message: 'Data received', data: entry });
});

// return metrics to dashboard
app.get('/api/green-metrics', (req, res) => {
  const rows = db.prepare(`
    SELECT
      repo,
      branch,
      commit_hash AS "commit",
      duration,
      runner_type,
      metric_type,
      step_name,
      phase,
      energy,
      co2,
      timestamp
    FROM metrics
    ORDER BY timestamp DESC
    LIMIT 200
  `).all();

  res.json(rows.reverse());
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Green Dev Backend running on http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
  console.error(`Failed to start Green Dev Backend: ${error.message}`);
  process.exit(1);
});
