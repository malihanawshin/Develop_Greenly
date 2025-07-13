import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function CarbonChart({ data }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-2">CO₂ Emissions per Commit</h2>
      <LineChart width={700} height={300} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="commit" />
        <YAxis label={{ value: 'CO₂ (g)', angle: -90, position: 'insideLeft' }} />
        <Tooltip />
        <Line type="monotone" dataKey="co2" stroke="#22c55e" strokeWidth={2} />
      </LineChart>
    </div>
  );
}
