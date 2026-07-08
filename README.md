# Green Dev Dashboard 🌱 

This project visualizes the carbon footprint of software development activities, helping developers and teams make more sustainable choices. It collects data from **GitHub Actions**, calculates green software metrics (**CO₂ emissions, energy consumption**), and displays them in an interactive dashboard. 
In this project, CO2 emission is estimated using simplified version of **Software Carbon Intensity** (SCI) specification by **Green Software Foundation** (GSF). The dashboard was hosted on AWS EC2.

## Features

* Fetches and displays metrics such as:

  * Repository name
  * Commit hash
  * Duration of run
  * Step-level phase breakdown for CI workflows
  * Energy consumed
  * Estimated CO₂ emissions
  * Timestamp of the activity
* Clean and minimal UI built with **React**
* API endpoint served via a **Node.js** or compatible backend

## Tech Stack

* **Frontend**: React + Tailwind CSS
* **Backend**: Node.js / Express (or compatible) serving `/api/green-metrics`
* **Tunneling**: Ngrok (used when GitHub Actions needs to send data to a local backend)
* **Deployment**: Docker / AWS EC2-ready setup

## Screenshot

<img width="1117" height="570" alt="Screenshot 2026-04-24 at 11 23 11 AM" src="https://github.com/user-attachments/assets/482064bc-3c40-4cef-8e56-83df28a8dbce" />

<!-- <img width="1166" height="573" alt="Screenshot 2026-04-24 at 11 33 08 AM" src="https://github.com/user-attachments/assets/2fd43409-a561-4883-a6f2-54f2746518c5" /> -->


## To Get Started

### 1. Clone the Repository

```bash
git clone https://github.com/malihanawshin/Develop_Greenly.git
cd green-dev-dashboard
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Frontend

```bash
npm run dev
```

### 4. Start Backend Server (if not already running)

Ensure your backend is running locally and exposes the `GET /api/green-metrics` endpoint.

Example:

```bash
node server.js
```

### 5. Connect GitHub Actions to the local backend with Ngrok

The frontend can read from the local backend directly through the Vite proxy. Ngrok is only needed when a GitHub-hosted workflow has to POST metrics into your local machine.

Start the backend:

```bash
cd green-dev-backend
npm start
```

In another terminal, expose the backend:

```bash
npx ngrok http 3000
```

Then add or update these GitHub repository secrets in the project whose workflow sends metrics:

```text
GREEN_METRICS_URL=https://your-ngrok-url.ngrok-free.app/api/green-metrics
GREEN_METRICS_TOKEN=your-shared-token
```

When running the backend with token protection enabled, use the same token locally:

```bash
METRICS_API_TOKEN=your-shared-token npm start
```

For a stable deployment, use a hosted backend URL instead of ngrok and keep the same `GREEN_METRICS_URL` secret.
---

## Step-Level CI Metrics

The backend accepts both commit-level metrics and step-level metrics. Use commit-level metrics for older workflows:

```json
{
  "repo": "owner/repo",
  "branch": "main",
  "commit": "abc123",
  "duration": 42,
  "runner_type": "Linux",
  "metric_type": "ci_build"
}
```

For step-level breakdowns, send `metric_type: "ci_step"` with a `step_name` and `phase`:

```json
{
  "repo": "owner/repo",
  "branch": "main",
  "commit": "abc123",
  "duration": 18,
  "runner_type": "Linux",
  "metric_type": "ci_step",
  "step_name": "frontend_build",
  "phase": "build"
}
```

Recommended phases:

```text
setup
dependencies
build
test
runtime
deploy
other
```

Example GitHub Actions timing pattern:

```yaml
- name: Record frontend build start
  id: frontend_build_start
  run: echo "time=$(date +%s)" >> "$GITHUB_OUTPUT"

- name: Build frontend
  working-directory: frontend
  run: npm run build

- name: Record frontend build end
  id: frontend_build_end
  run: echo "time=$(date +%s)" >> "$GITHUB_OUTPUT"

- name: Send frontend build step metric
  run: |
    duration=$((${{ steps.frontend_build_end.outputs.time }} - ${{ steps.frontend_build_start.outputs.time }}))

    curl --fail --show-error --silent -X POST "$GREEN_METRICS_URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $GREEN_METRICS_TOKEN" \
      -d '{
        "repo": "${{ github.repository }}",
        "branch": "${{ github.ref_name }}",
        "commit": "${{ github.sha }}",
        "duration": '"$duration"',
        "runner_type": "${{ runner.os }}",
        "metric_type": "ci_step",
        "step_name": "frontend_build",
        "phase": "build"
      }'
```

## Sample Response

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
    "timestamp": "2025-07-14T18:08:37.987Z"
  }
]
```

## License

This project is under the [MIT License](LICENSE).
