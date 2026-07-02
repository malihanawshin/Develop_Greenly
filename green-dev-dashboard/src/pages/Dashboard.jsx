import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatNumber = (value, digits = 2) => Number(value || 0).toFixed(digits);

const formatDuration = (seconds) => {
  const value = Number(seconds || 0);
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
};

const shortRepo = (repo = '') => repo.split('/').pop() || repo || 'Unknown';

const shortCommit = (commit = '') => commit.slice(0, 7) || 'unknown';

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Unknown';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

const co2Level = (co2) => {
  if (co2 < 4) return 'low';
  if (co2 < 8) return 'mid';
  return 'high';
};

function buildRepoSummary(metrics) {
  const summaries = new Map();

  metrics.forEach((run) => {
    const existing = summaries.get(run.repo) || {
      repo: run.repo,
      runs: 0,
      totalCo2: 0,
      totalEnergy: 0,
      totalDuration: 0,
      latestRun: null,
      worstRun: null,
    };

    const co2 = Number(run.co2 || 0);
    const energy = Number(run.energy || 0);
    const duration = Number(run.duration || 0);
    const timestamp = new Date(run.timestamp).getTime();

    existing.runs += 1;
    existing.totalCo2 += co2;
    existing.totalEnergy += energy;
    existing.totalDuration += duration;

    if (!existing.latestRun || timestamp > new Date(existing.latestRun.timestamp).getTime()) {
      existing.latestRun = run;
    }

    if (!existing.worstRun || co2 > Number(existing.worstRun.co2 || 0)) {
      existing.worstRun = run;
    }

    summaries.set(run.repo, existing);
  });

  return Array.from(summaries.values())
    .map((summary) => ({
      ...summary,
      avgDuration: summary.runs ? summary.totalDuration / summary.runs : 0,
    }))
    .sort((a, b) => b.totalCo2 - a.totalCo2);
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/green-metrics', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got: ${text.slice(0, 100)}`);
      }

      setMetrics(await response.json());
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const sortedMetrics = useMemo(
    () => [...metrics].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    [metrics],
  );

  const repoSummary = useMemo(() => buildRepoSummary(metrics), [metrics]);

  const totals = useMemo(() => {
    const totalCo2 = metrics.reduce((sum, run) => sum + Number(run.co2 || 0), 0);
    const totalEnergy = metrics.reduce((sum, run) => sum + Number(run.energy || 0), 0);
    const totalDuration = metrics.reduce((sum, run) => sum + Number(run.duration || 0), 0);

    return {
      totalCo2,
      totalEnergy,
      avgDuration: metrics.length ? totalDuration / metrics.length : 0,
      runCount: metrics.length,
      repoCount: repoSummary.length,
      worstRun: metrics.reduce((worst, run) => (
        !worst || Number(run.co2 || 0) > Number(worst.co2 || 0) ? run : worst
      ), null),
      latestRun: metrics.reduce((latest, run) => (
        !latest || new Date(run.timestamp) > new Date(latest.timestamp) ? run : latest
      ), null),
    };
  }, [metrics, repoSummary.length]);

  const trendData = sortedMetrics.map((run, index) => ({
    ...run,
    label: `${index + 1}. ${shortRepo(run.repo)}`,
    co2: Number(run.co2 || 0),
    energy: Number(run.energy || 0),
  }));

  const repoChartData = repoSummary.map((summary) => ({
    repo: shortRepo(summary.repo),
    co2: Number(summary.totalCo2.toFixed(2)),
    energy: Number(summary.totalEnergy.toFixed(4)),
    runs: summary.runs,
  }));

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="brand-mark" aria-hidden="true">
          <span>G</span>
        </div>
        <div>
          <p className="eyebrow">CI/CD carbon observatory</p>
          <h1>Green Dev Dashboard</h1>
          <p className="dashboard-subtitle">
            Repository-level build energy, CO2 emissions, and workflow run comparisons.
          </p>
        </div>
        <button type="button" className="refresh-button" onClick={fetchMetrics} disabled={isLoading}>
          {isLoading ? 'Refreshing' : 'Refresh'}
        </button>
      </header>

      {error && (
        <section className="alert-panel">
          <strong>Could not load metrics.</strong>
          <span>{error}</span>
        </section>
      )}

      {!error && metrics.length === 0 && !isLoading && (
        <section className="empty-panel">
          <h2>No workflow metrics yet</h2>
          <p>Trigger a GitHub Actions workflow that posts to /api/green-metrics.</p>
        </section>
      )}

      {metrics.length > 0 && (
        <>
          <section className="kpi-grid" aria-label="Build carbon summary">
            <article className="kpi-card">
              <span>Total CO2</span>
              <strong>{formatNumber(totals.totalCo2, 2)}g</strong>
              <small>grams CO2 equivalent</small>
            </article>
            <article className="kpi-card">
              <span>Total Energy</span>
              <strong>{formatNumber(totals.totalEnergy, 4)}</strong>
              <small>kWh consumed by builds</small>
            </article>
            <article className="kpi-card">
              <span>Average Duration</span>
              <strong>{formatDuration(totals.avgDuration)}</strong>
              <small>per workflow run</small>
            </article>
            <article className="kpi-card">
              <span>Tracked Repos</span>
              <strong>{totals.repoCount}</strong>
              <small>{totals.runCount} workflow runs</small>
            </article>
          </section>

          <section className="insight-grid">
            <article className="insight-panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Trend</p>
                  <h2>CO2 emissions across recent runs</h2>
                </div>
                <span className="model-pill">SCI-inspired estimate</span>
              </div>
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 18, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="co2Fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#639922" stopOpacity={0.34} />
                        <stop offset="95%" stopColor="#639922" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5edd8" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}g`} />
                    <Tooltip
                      formatter={(value) => [`${formatNumber(value, 2)}g`, 'CO2']}
                      labelFormatter={(_, payload) => {
                        const run = payload?.[0]?.payload;
                        return run ? `${run.repo} · ${shortCommit(run.commit)}` : '';
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="co2"
                      stroke="#3b6d11"
                      strokeWidth={2}
                      fill="url(#co2Fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="insight-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="eyebrow">Comparison</p>
                  <h2>Emissions by repo</h2>
                </div>
              </div>
              <div className="chart-frame compact-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={repoChartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke="#eef4e6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}g`} />
                    <YAxis type="category" dataKey="repo" tick={{ fontSize: 11 }} width={88} />
                    <Tooltip formatter={(value) => [`${formatNumber(value, 2)}g`, 'Total CO2']} />
                    <Bar dataKey="co2" fill="#639922" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="insight-grid">
            <article className="insight-panel">
              <p className="eyebrow">Highest build cost</p>
              <h2>{shortRepo(totals.worstRun?.repo)}</h2>
              <div className="highlight-number">{formatNumber(totals.worstRun?.co2, 2)}g CO2</div>
              <p className="muted">
                {formatDuration(totals.worstRun?.duration)} on {totals.worstRun?.branch || 'unknown branch'} ·{' '}
                {shortCommit(totals.worstRun?.commit)}
              </p>
            </article>

            <article className="insight-panel">
              <p className="eyebrow">Latest received run</p>
              <h2>{shortRepo(totals.latestRun?.repo)}</h2>
              <div className="highlight-number">{formatTimestamp(totals.latestRun?.timestamp)}</div>
              <p className="muted">
                {formatNumber(totals.latestRun?.energy, 4)} kWh · {formatNumber(totals.latestRun?.co2, 2)}g CO2
              </p>
            </article>

            <article className="insight-panel assumptions">
              <p className="eyebrow">Model assumptions</p>
              <h2>Transparent estimate</h2>
              <ul>
                <li>Energy = duration x estimated runner power</li>
                <li>Carbon factor = 475 gCO2/kWh</li>
                <li>CPU load, memory, and grid region are future model inputs</li>
              </ul>
            </article>
          </section>

          <section className="repo-table-panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Repository comparison</p>
                <h2>Build cost by repository</h2>
              </div>
            </div>
            <div className="repo-cards">
              {repoSummary.map((summary) => (
                <article className="repo-card" key={summary.repo}>
                  <div>
                    <h3>{shortRepo(summary.repo)}</h3>
                    <p>{summary.repo}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Runs</dt>
                      <dd>{summary.runs}</dd>
                    </div>
                    <div>
                      <dt>Total CO2</dt>
                      <dd>{formatNumber(summary.totalCo2, 2)}g</dd>
                    </div>
                    <div>
                      <dt>Avg duration</dt>
                      <dd>{formatDuration(summary.avgDuration)}</dd>
                    </div>
                    <div>
                      <dt>Worst run</dt>
                      <dd>{formatNumber(summary.worstRun?.co2, 2)}g</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="runs-panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Recent workflow runs</p>
                <h2>Raw CI metrics</h2>
              </div>
              <code>GET /api/green-metrics</code>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Branch</th>
                    <th>Commit</th>
                    <th>Runner</th>
                    <th>Duration</th>
                    <th>Energy</th>
                    <th>CO2</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics].reverse().map((run) => (
                    <tr key={`${run.repo}-${run.commit}-${run.timestamp}`}>
                      <td>
                        <strong>{shortRepo(run.repo)}</strong>
                        <span>{run.repo}</span>
                      </td>
                      <td>{run.branch || 'unknown'}</td>
                      <td>
                        <code>{shortCommit(run.commit)}</code>
                      </td>
                      <td>{run.runner_type || 'unknown'}</td>
                      <td className="numeric">{formatDuration(run.duration)}</td>
                      <td className="numeric">{formatNumber(run.energy, 4)}</td>
                      <td>
                        <span className={`co2-pill ${co2Level(Number(run.co2 || 0))}`}>
                          {formatNumber(run.co2, 2)}g
                        </span>
                      </td>
                      <td>{formatTimestamp(run.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
