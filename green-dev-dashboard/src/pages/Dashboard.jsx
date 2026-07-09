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

const truncateEnd = (value = '', maxLength = 18) => (
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
);

const phaseLabels = {
  setup: 'Setup',
  dependencies: 'Dependencies',
  build: 'Build',
  test: 'Tests',
  runtime: 'Runtime',
  deploy: 'Deploy',
  other: 'Other',
};

const phaseOrder = ['setup', 'dependencies', 'build', 'test', 'runtime', 'deploy', 'other'];

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

function metricTotals(run) {
  return {
    duration: Number(run?.duration || 0),
    energy: Number(run?.energy || 0),
    co2: Number(run?.co2 || 0),
  };
}

function sumMetrics(runs) {
  return runs.reduce((totals, run) => ({
    duration: totals.duration + Number(run.duration || 0),
    energy: totals.energy + Number(run.energy || 0),
    co2: totals.co2 + Number(run.co2 || 0),
  }), { duration: 0, energy: 0, co2: 0 });
}

function normalizePhase(run) {
  if (run.phase) return run.phase;
  if (run.metric_type === 'runtime_smoke_test') return 'runtime';
  return 'build';
}

function buildStepPhases(steps) {
  const phases = new Map();

  steps.forEach((step) => {
    const phase = normalizePhase(step);
    const existing = phases.get(phase) || {
      phase,
      label: phaseLabels[phase] || phaseLabels.other,
      steps: [],
      duration: 0,
      energy: 0,
      co2: 0,
    };

    existing.steps.push(step);
    existing.duration += Number(step.duration || 0);
    existing.energy += Number(step.energy || 0);
    existing.co2 += Number(step.co2 || 0);
    phases.set(phase, existing);
  });

  return Array.from(phases.values()).sort((a, b) => {
    const aIndex = phaseOrder.indexOf(a.phase);
    const bIndex = phaseOrder.indexOf(b.phase);
    return (aIndex === -1 ? phaseOrder.length : aIndex) - (bIndex === -1 ? phaseOrder.length : bIndex);
  });
}

function buildCommitGroups(metrics) {
  const groups = new Map();

  metrics.forEach((run) => {
    const key = `${run.repo || 'unknown'}::${run.commit || 'unknown'}`;
    const existing = groups.get(key) || {
      key,
      repo: run.repo,
      branch: run.branch,
      commit: run.commit,
      runner_type: run.runner_type,
      timestamp: run.timestamp,
      phases: {},
      steps: [],
      totalDuration: 0,
      totalEnergy: 0,
      totalCo2: 0,
    };

    const metricType = run.metric_type || 'ci_build';
    if (metricType === 'ci_step' || run.step_name) {
      existing.steps.push({
        ...run,
        phase: normalizePhase(run),
        step_name: run.step_name || metricType,
      });
    } else {
      existing.phases[metricType] = run;
    }

    if (new Date(run.timestamp) > new Date(existing.timestamp)) {
      existing.timestamp = run.timestamp;
    }

    existing.branch = existing.branch || run.branch;
    existing.runner_type = existing.runner_type || run.runner_type;
    groups.set(key, existing);
  });

  return Array.from(groups.values())
    .map((group) => {
      const stepPhases = buildStepPhases(group.steps);
      const hasStepMetrics = group.steps.length > 0;
      const legacyValues = Object.values(group.phases);
      const nonRuntimeSteps = group.steps.filter((step) => normalizePhase(step) !== 'runtime');
      const runtimeSteps = group.steps.filter((step) => normalizePhase(step) === 'runtime');
      const buildTotals = hasStepMetrics ? sumMetrics(nonRuntimeSteps) : metricTotals(group.phases.ci_build);
      const runtimeTotals = hasStepMetrics ? sumMetrics(runtimeSteps) : metricTotals(group.phases.runtime_smoke_test);
      const groupTotals = hasStepMetrics ? sumMetrics(group.steps) : sumMetrics(legacyValues);

      return {
        ...group,
        hasStepMetrics,
        stepPhases,
        buildTotals,
        runtimeTotals,
        totalDuration: groupTotals.duration,
        totalEnergy: groupTotals.energy,
        totalCo2: groupTotals.co2,
      };
    })
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function buildRepoSummary(commitGroups) {
  const summaries = new Map();

  commitGroups.forEach((group) => {
    const existing = summaries.get(group.repo) || {
      repo: group.repo,
      runs: 0,
      totalCo2: 0,
      totalEnergy: 0,
      totalDuration: 0,
      latestRun: null,
      worstRun: null,
    };

    const timestamp = new Date(group.timestamp).getTime();

    existing.runs += 1;
    existing.totalCo2 += group.totalCo2;
    existing.totalEnergy += group.totalEnergy;
    existing.totalDuration += group.totalDuration;

    if (!existing.latestRun || timestamp > new Date(existing.latestRun.timestamp).getTime()) {
      existing.latestRun = group;
    }

    if (!existing.worstRun || group.totalCo2 > Number(existing.worstRun.totalCo2 || 0)) {
      existing.worstRun = group;
    }

    summaries.set(group.repo, existing);
  });

  return Array.from(summaries.values())
    .map((summary) => ({
      ...summary,
      avgDuration: summary.runs ? summary.totalDuration / summary.runs : 0,
    }))
    .sort((a, b) => b.totalCo2 - a.totalCo2);
}

function buildRecommendations(commitGroups, repoSummary) {
  const recommendations = [];
  const stepEnabledGroups = commitGroups.filter((group) => group.hasStepMetrics);

  if (repoSummary.length > 0) {
    const highestImpactRepo = repoSummary[0];
    recommendations.push({
      key: `highest-impact-${highestImpactRepo.repo}`,
      severity: 'high',
      title: 'Start with the highest-impact repository',
      repo: highestImpactRepo.repo,
      message: `${shortRepo(highestImpactRepo.repo)} contributes the most estimated CI CO2 in the current dataset.`,
      action: 'Review workflow triggers, dependency caching, and repeated build frequency for this repository first.',
      evidence: `${formatNumber(highestImpactRepo.totalCo2, 2)}g CO2 across ${highestImpactRepo.runs} commit groups`,
    });
  }

  const groupsByRepo = new Map();
  commitGroups.forEach((group) => {
    const groups = groupsByRepo.get(group.repo) || [];
    groups.push(group);
    groupsByRepo.set(group.repo, groups);
  });

  groupsByRepo.forEach((groups, repo) => {
    const sortedGroups = [...groups].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const latest = sortedGroups[sortedGroups.length - 1];
    const previous = sortedGroups[sortedGroups.length - 2];

    if (groups.length >= 4) {
      recommendations.push({
        key: `frequent-runs-${repo}`,
        severity: 'medium',
        title: 'Frequent workflow runs detected',
        repo,
        message: `${shortRepo(repo)} has several recent CI measurements in the dashboard.`,
        action: 'Add path filters so README-only or documentation-only changes do not trigger full build and runtime checks.',
        evidence: `${groups.length} commit groups in the current API window`,
      });
    }

    if (latest && !latest.hasStepMetrics) {
      recommendations.push({
        key: `missing-step-data-${repo}`,
        severity: 'medium',
        title: 'Add step-level measurement',
        repo,
        message: `${shortRepo(repo)} is still reporting aggregate build/runtime metrics only.`,
        action: 'Send ci_step rows for dependency install, build, test, runtime, and deploy to locate the exact energy hotspot.',
        evidence: 'No step_name or phase fields found for the latest commit group',
      });
    }

    if (latest && !latest.hasStepMetrics && !latest.phases.runtime_smoke_test) {
      recommendations.push({
        key: `missing-runtime-${repo}`,
        severity: 'low',
        title: 'Runtime cost is not captured',
        repo,
        message: `${shortRepo(repo)} has no runtime smoke metric in the latest commit group.`,
        action: 'Add a minimal smoke test that starts the app, checks one health or UI endpoint, and exits quickly.',
        evidence: `Latest commit ${shortCommit(latest.commit)}`,
      });
    }

    if (latest && previous && previous.totalDuration > 0 && latest.totalDuration > previous.totalDuration * 1.25) {
      recommendations.push({
        key: `duration-regression-${repo}-${latest.commit}`,
        severity: 'high',
        title: 'CI duration increased',
        repo,
        message: `${shortRepo(repo)} is slower than its previous measured commit.`,
        action: 'Inspect dependency changes, build configuration changes, or newly added runtime checks in this commit.',
        evidence: `${formatDuration(previous.totalDuration)} -> ${formatDuration(latest.totalDuration)}`,
      });
    }
  });

  stepEnabledGroups.forEach((group) => {
    group.stepPhases.forEach((phase) => {
      const share = group.totalDuration ? phase.duration / group.totalDuration : 0;

      if (phase.phase === 'dependencies' && share >= 0.35) {
        recommendations.push({
          key: `dependency-heavy-${group.key}`,
          severity: 'high',
          title: 'Dependency installation dominates this workflow',
          repo: group.repo,
          message: `${phase.label} uses ${Math.round(share * 100)}% of the measured CI time for ${shortRepo(group.repo)}.`,
          action: 'Enable package-manager caching and prefer clean installs only when the lockfile changes.',
          evidence: `${formatDuration(phase.duration)} of ${formatDuration(group.totalDuration)} on ${shortCommit(group.commit)}`,
        });
      }

      if (phase.phase === 'runtime' && share >= 0.3) {
        recommendations.push({
          key: `runtime-heavy-${group.key}`,
          severity: 'medium',
          title: 'Runtime smoke test is relatively expensive',
          repo: group.repo,
          message: `Runtime checks use ${Math.round(share * 100)}% of the measured CI time for ${shortRepo(group.repo)}.`,
          action: 'Keep the smoke test, but check only the critical startup path and stop services immediately after success.',
          evidence: `${formatDuration(phase.duration)} runtime on ${shortCommit(group.commit)}`,
        });
      }

      if (phase.phase === 'build' && share >= 0.5) {
        recommendations.push({
          key: `build-heavy-${group.key}`,
          severity: 'medium',
          title: 'Build phase is the main energy driver',
          repo: group.repo,
          message: `Build steps use ${Math.round(share * 100)}% of the measured CI time for ${shortRepo(group.repo)}.`,
          action: 'Check whether all build targets are needed on every push and consider splitting heavy checks by path.',
          evidence: `${formatDuration(phase.duration)} build time on ${shortCommit(group.commit)}`,
        });
      }
    });
  });

  const severityRank = { high: 0, medium: 1, low: 2 };
  const uniqueRecommendations = Array.from(
    new Map(recommendations.map((recommendation) => [recommendation.key, recommendation])).values(),
  );

  return uniqueRecommendations
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 6);
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

  const commitGroups = useMemo(() => buildCommitGroups(metrics), [metrics]);

  const repoSummary = useMemo(() => buildRepoSummary(commitGroups), [commitGroups]);

  const recommendations = useMemo(
    () => buildRecommendations(commitGroups, repoSummary),
    [commitGroups, repoSummary],
  );

  const totals = useMemo(() => {
    const totalCo2 = commitGroups.reduce((sum, group) => sum + group.totalCo2, 0);
    const totalEnergy = commitGroups.reduce((sum, group) => sum + group.totalEnergy, 0);
    const totalDuration = commitGroups.reduce((sum, group) => sum + group.totalDuration, 0);

    return {
      totalCo2,
      totalEnergy,
      avgDuration: commitGroups.length ? totalDuration / commitGroups.length : 0,
      runCount: commitGroups.length,
      repoCount: repoSummary.length,
      worstRun: commitGroups.reduce((worst, group) => (
        !worst || group.totalCo2 > Number(worst.totalCo2 || 0) ? group : worst
      ), null),
      latestRun: commitGroups.reduce((latest, group) => (
        !latest || new Date(group.timestamp) > new Date(latest.timestamp) ? group : latest
      ), null),
    };
  }, [commitGroups, repoSummary.length]);

  const trendData = commitGroups.map((group, index) => ({
    ...group,
    label: `${index + 1}. ${shortRepo(group.repo)}`,
    co2: group.totalCo2,
    energy: group.totalEnergy,
  }));

  const repoChartData = repoSummary.map((summary) => ({
    repo: truncateEnd(shortRepo(summary.repo)),
    fullRepo: summary.repo,
    co2: Number(summary.totalCo2.toFixed(2)),
    energy: Number(summary.totalEnergy.toFixed(4)),
    runs: summary.runs,
  }));

  const stepEnabledGroups = [...commitGroups]
    .filter((group) => group.hasStepMetrics)
    .reverse()
    .slice(0, 4);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="brand-mark" aria-hidden="true">
          <span>G</span>
        </div>
        <div>
          <p className="eyebrow">CI/CD carbon observatory</p>
          <h1>Develop Greenly</h1>
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
              <small>{totals.runCount} commit groups</small>
            </article>
          </section>

          <section className="insight-grid">
            <article className="insight-panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Trend</p>
                  <h2>Total CO2 across recent commits</h2>
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
                    <YAxis type="category" dataKey="repo" tick={{ fontSize: 11 }} width={112} />
                    <Tooltip
                      formatter={(value) => [`${formatNumber(value, 2)}g`, 'Total CO2']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullRepo || ''}
                    />
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
              <div className="highlight-number">{formatNumber(totals.worstRun?.totalCo2, 2)}g CO2</div>
              <p className="muted">
                {formatDuration(totals.worstRun?.totalDuration)} on {totals.worstRun?.branch || 'unknown branch'} ·{' '}
                {shortCommit(totals.worstRun?.commit)}
              </p>
            </article>

            <article className="insight-panel">
              <p className="eyebrow">Latest received run</p>
              <h2>{shortRepo(totals.latestRun?.repo)}</h2>
              <div className="highlight-number">{formatTimestamp(totals.latestRun?.timestamp)}</div>
              <p className="muted">
                {formatNumber(totals.latestRun?.totalEnergy, 4)} kWh · {formatNumber(totals.latestRun?.totalCo2, 2)}g CO2
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
                      <dd>{formatNumber(summary.worstRun?.totalCo2, 2)}g</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="recommendations-panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Optimization recommendations</p>
                <h2>Explainable CI energy actions</h2>
              </div>
              <span className="model-pill">Rule-based assistant</span>
            </div>
            {recommendations.length > 0 ? (
              <div className="recommendation-grid">
                {recommendations.map((recommendation) => (
                  <article className={`recommendation-card ${recommendation.severity}`} key={recommendation.key}>
                    <div className="recommendation-header">
                      <span>{recommendation.severity}</span>
                      <strong>{shortRepo(recommendation.repo)}</strong>
                    </div>
                    <h3>{recommendation.title}</h3>
                    <p>{recommendation.message}</p>
                    <dl>
                      <div>
                        <dt>Action</dt>
                        <dd>{recommendation.action}</dd>
                      </div>
                      <div>
                        <dt>Evidence</dt>
                        <dd>{recommendation.evidence}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <div className="step-empty-state">
                <strong>No recommendations yet.</strong>
                <span>Collect more workflow metrics to reveal optimization opportunities.</span>
              </div>
            )}
          </section>

          <section className="step-breakdown-panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Step-level CI breakdown</p>
                <h2>Where workflow energy is spent</h2>
              </div>
            </div>
            {stepEnabledGroups.length > 0 ? (
              <div className="step-breakdown-grid">
                {stepEnabledGroups.map((group) => (
                  <article className="step-breakdown-card" key={`steps-${group.key}`}>
                    <div className="step-card-header">
                      <div>
                        <h3>{shortRepo(group.repo)}</h3>
                        <p>{shortCommit(group.commit)} · {formatTimestamp(group.timestamp)}</p>
                      </div>
                      <span className={`co2-pill ${co2Level(group.totalCo2)}`}>
                        {formatNumber(group.totalCo2, 2)}g
                      </span>
                    </div>
                    <div className="phase-bars">
                      {group.stepPhases.map((phase) => {
                        const width = group.totalDuration
                          ? Math.max((phase.duration / group.totalDuration) * 100, 4)
                          : 0;

                        return (
                          <div className="phase-row" key={`${group.key}-${phase.phase}`}>
                            <div className="phase-row-label">
                              <strong>{phase.label}</strong>
                              <span>{formatDuration(phase.duration)}</span>
                            </div>
                            <div className="phase-track" aria-hidden="true">
                              <span style={{ width: `${width}%` }} />
                            </div>
                            <div className="phase-row-metrics">
                              <span>{formatNumber(phase.energy, 4)} kWh</span>
                              <span>{formatNumber(phase.co2, 2)}g CO2</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <details className="step-details">
                      <summary>{group.steps.length} captured steps</summary>
                      <ul>
                        {group.steps.map((step) => (
                          <li key={`${group.key}-${step.step_name}-${step.timestamp}`}>
                            <span>{step.step_name}</span>
                            <strong>{formatDuration(step.duration)}</strong>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              <div className="step-empty-state">
                <strong>No step-level rows yet.</strong>
                <span>Send metrics with metric_type "ci_step", plus step_name and phase, to unlock this breakdown.</span>
              </div>
            )}
          </section>

          <section className="runs-panel">
            <div className="panel-heading table-heading">
              <div>
                <p className="eyebrow">Recent workflow runs</p>
                <h2>Commit-level build and runtime costs</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <colgroup>
                  <col className="col-repository" />
                  <col className="col-branch" />
                  <col className="col-commit" />
                  <col className="col-runner" />
                  <col className="col-metric" />
                  <col className="col-metric" />
                  <col className="col-metric" />
                  <col className="col-time" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Branch</th>
                    <th>Commit</th>
                    <th>Runner</th>
                    <th>Build</th>
                    <th>Runtime</th>
                    <th>Total</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {[...commitGroups].reverse().map((group) => {
                    const build = group.buildTotals;
                    const runtime = group.runtimeTotals;

                    return (
                      <tr key={group.key}>
                        <td className="repository-cell">
                          <strong>{shortRepo(group.repo)}</strong>
                          <span>{group.repo}</span>
                        </td>
                        <td>{group.branch || 'unknown'}</td>
                        <td>
                          <code>{shortCommit(group.commit)}</code>
                        </td>
                        <td>{group.runner_type || 'unknown'}</td>
                        <td>
                          {group.hasStepMetrics || group.phases.ci_build ? (
                            <div className="metric-stack">
                              <strong>{formatDuration(build.duration)}</strong>
                              <span>{formatNumber(build.energy, 4)} kWh</span>
                              <span>{formatNumber(build.co2, 2)}g CO2</span>
                              {group.hasStepMetrics && <span>{group.steps.filter((step) => step.phase !== 'runtime').length} steps</span>}
                            </div>
                          ) : (
                            <span className="missing-metric">Not captured</span>
                          )}
                        </td>
                        <td>
                          {(group.hasStepMetrics ? runtime.duration > 0 : group.phases.runtime_smoke_test) ? (
                            <div className="metric-stack">
                              <strong>{formatDuration(runtime.duration)}</strong>
                              <span>{formatNumber(runtime.energy, 4)} kWh</span>
                              <span>{formatNumber(runtime.co2, 2)}g CO2</span>
                              {group.hasStepMetrics && <span>{group.steps.filter((step) => step.phase === 'runtime').length} steps</span>}
                            </div>
                          ) : (
                            <span className="missing-metric">Not captured</span>
                          )}
                        </td>
                        <td>
                          <div className="metric-stack total">
                            <strong>{formatDuration(group.totalDuration)}</strong>
                            <span>{formatNumber(group.totalEnergy, 4)} kWh</span>
                            <span className={`co2-pill ${co2Level(group.totalCo2)}`}>
                              {formatNumber(group.totalCo2, 2)}g
                            </span>
                          </div>
                        </td>
                        <td>{formatTimestamp(group.timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
