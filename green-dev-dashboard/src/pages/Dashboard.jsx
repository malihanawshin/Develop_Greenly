import React, { useEffect, useState } from 'react';
import CarbonChart from '../components/CarbonChart';

export default function Dashboard() {
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    //replace later with actual backend API
    fetch('http://localhost:3000/api/green-metrics')
      .then((res) => res.json())
      .then((data) => setMetrics(data));
  }, []);

  useEffect(() => {
    setMetrics([
      { commit: 'a1b2c3', co2: 34 },
      { commit: 'd4e5f6', co2: 29 },
      { commit: 'g7h8i9', co2: 45 },
    ]);
  }, []);
  

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Green Dev Dashboard 🌱 </h1>
      <CarbonChart data={metrics} />
    </div>
  );
}
