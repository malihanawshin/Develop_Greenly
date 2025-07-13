// server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

//temporary storage (replace with DB later)
let metrics = [];

app.use(cors());
app.use(express.json());

//emission estimated using simplified version of "Software Carbon Intensity (SCI)" specification by Green Software Foundation (GSF)
//simplified formula: CO₂ = Time × Power Draw × Carbon Intensity
//this method does not account for idle time, actual CPU usage, or memory load.
//assumes one CI runner (not parallel builds).
//uses global average carbon intensity, not actual regional grid mix.

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
  const { repo, branch, commit, duration, runner_type } = req.body;

  if (!repo || !commit || !duration) {
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
  res.json({ message: 'Data received', data: entry });
});

// return metrics to dashboard
app.get('/api/green-metrics', (req, res) => {
  res.json(metrics.slice(-20)); // Return latest 20 entries
});

app.listen(PORT, () => {
  console.log(`Green Dev Backend running on http://localhost:${PORT}`);
});
