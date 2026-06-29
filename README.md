# Green Dev Dashboard 🌱 

This project visualizes the carbon footprint of software development activities, helping developers and teams make more sustainable choices. It collects data from **GitHub Actions**, calculates green software metrics (**CO₂ emissions, energy consumption**), and displays them in an interactive dashboard. 
In this project, CO2 emission is estimated using simplified version of **Software Carbon Intensity** (SCI) specification by **Green Software Foundation** (GSF). The dashboard was hosted on AWS EC2.

## Features

* Fetches and displays metrics such as:

  * Repository name
  * Commit hash
  * Duration of run

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

## Sample Response

```json
[
  {
    "repo": "malihanawshin/LAN-Chat",
    "branch": "main",
    "commit": "be7787a42f9561fad8c17cfdbb4e81ac461d36c1",
    "duration": 15,
    "runner_type": "Linux",
    "energy": 0.0125,
    "co2": 5.94,
    "timestamp": "2025-07-14T18:08:37.987Z"
  }
]
```

## License

This project is under the [MIT License](LICENSE).
