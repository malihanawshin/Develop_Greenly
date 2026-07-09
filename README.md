# Develop Greenly

Develop Greenly is a software sustainability observatory for CI/CD workflows. It collects metrics from GitHub Actions, estimates energy consumption and CO2 emissions, stores the data in SQLite, and presents repository-level insights in an interactive dashboard. CO2 emission is estimated using simplified version of Software Carbon Intensity (SCI) specification by Green Software Foundation (GSF):

```text
CO2 = workflow duration x estimated runner energy use x carbon intensity
```

The dashboard is hosted on AWS EC2, available live at http://63.179.89.6/.

## Features

- Collects CI/CD metrics from GitHub Actions through a backend API.
- Stores workflow history in SQLite for persistent dashboard data.
- Tracks repository, branch, commit, runner type, duration, energy, CO2, timestamp, metric type, step name, and workflow phase.
- Compares build and runtime smoke-test cost across repositories.
- Groups related metrics by repository and commit.
- Shows total CO2, total energy, average duration, tracked repositories, highest-cost run, and latest received run.
- Visualizes CO2 trends across recent commits.
- Compares repository emissions using charts and summary cards.
- Supports step-level CI breakdowns for phases such as dependencies, build, tests, runtime, deploy, and setup.
- Provides optimization recommendations based on workflow patterns, step-level hotspots, missing runtime metrics, missing step data, frequent runs, and CI duration regressions.
- Runs locally or on AWS EC2 using Docker Compose.

## Tech Stack

- **Frontend**: React, Vite, Recharts, CSS
- **Backend**: Node.js, Express
- **Database**: SQLite with `better-sqlite3`
- **CI Source**: GitHub Actions
- **Deployment**: Docker Compose on AWS EC2

## Architecture

```text
GitHub Actions workflow
        |
        | POST /api/green-metrics
        v
Node.js / Express backend
        |
        | stores metrics
        v
SQLite database
        |
        | GET /api/green-metrics
        v
React dashboard
```

## Dashboard Views

The dashboard includes:

- **KPI summary** for total CO2, energy, average duration, and tracked repositories.
- **Trend chart** showing CO2 across recent commits.
- **Repository comparison** showing cumulative impact per repository.
- **Optimization recommendations** with severity, evidence, and suggested action.
- **Step-level CI breakdown** showing where workflow energy is spent.
- **Recent workflow runs table** combining build, runtime, and total metrics by commit.

## Getting Started Locally

Clone the repository:

```bash
git clone https://github.com/malihanawshin/Develop_Greenly.git
cd Develop_Greenly
```

Create an environment file for the backend token:

```text
METRICS_API_TOKEN=your-shared-token
```

Start the full app with Docker Compose:

```bash
docker-compose up -d --build
```

## Running Without Docker

Start the backend:

```bash
cd green-dev-backend
npm install
METRICS_API_TOKEN=your-shared-token npm start
```

Start the frontend:

```bash
cd green-dev-dashboard
npm install
npm run dev
```

## GitHub Actions Integration

Each repository that sends metrics should define these secrets:

```text
GREEN_METRICS_URL=http://your-server/api/green-metrics
GREEN_METRICS_TOKEN=your-shared-token
```

The workflow sends JSON metrics to the backend:

```json
{
  "repo": "owner/repository",
  "branch": "main",
  "commit": "commit-sha",
  "duration": 42,
  "runner_type": "Linux",
  "metric_type": "ci_build"
}
```

The backend estimates energy and CO2, adds a timestamp, and stores the row in SQLite.

Example response:

```json
[
  {
    "repo": "malihanawshin/LAN-Chat",
    "branch": "main",
    "commit": "be7787a42f9561fad8c17cfdbb4e81ac461d36c1",
    "duration": 15,
    "runner_type": "Linux",
    "metric_type": "ci_step",
    "step_name": "compile_server",
    "phase": "build",
    "energy": 0.0125,
    "co2": 5.94,
    "timestamp": "2026-07-01T18:08:37.987Z"
  }
]
```

## Deployment

The app is deployed on one AWS EC2 instance with Docker Compose.

On the EC2 instance:

```bash
git clone https://github.com/malihanawshin/Develop_Greenly.git
cd Develop_Greenly
docker-compose up -d --build
```

After pushing changes:

```bash
cd ~/Develop_Greenly
git pull origin main
docker-compose up -d --build
```

The SQLite database is stored in a Docker volume so dashboard data survives container rebuilds.

## Upcoming Features

- Region-aware carbon intensity using live or configurable grid data.
- Improved SCI calculation with CPU, memory, and runner utilization inputs.
- AI-assisted recommendation summaries based on rule findings and historical trends.
- Repository onboarding templates for Node.js, Python, Java/Maven, C++, Next.js, React Native, and mobile projects.
- Exportable CSV/JSON reports for applications, portfolio documentation, and sustainability analysis.
- Advanced filters by repository, branch, date range, metric type, phase, and runner type.
- Regression alerts when CI energy or duration increases significantly.
- Saved baselines for comparing commits, branches, and repositories over time.
- Authentication and dashboard access control for hosted deployments.

## Current Limitations

- Energy and CO2 values are estimates, not direct hardware measurements.
- The model uses a fixed runner power assumption and fixed carbon factor.
- CPU load, memory usage, runner region, and grid carbon intensity are not yet included.
- GitHub-hosted runner data is represented by runner operating system only.
- Recommendations are rule-based and explainable, not generated by an external AI model.


## License

This project is under the [MIT License](LICENSE).
