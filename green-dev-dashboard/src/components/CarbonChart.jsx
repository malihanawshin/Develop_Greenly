import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';

export default function CarbonChart({ data }) {
  console.log('Chart received data:', data);

  if (!data || data.length === 0) {
    return <div>No data to display</div>;
  }

  // transform data to ensure timestamps are in milliseconds for recharts
  const formattedData = data.map(item => ({
    ...item,
    timestamp: new Date(item.timestamp).getTime(),
  }));

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">CO₂ Emissions and Energy Usage</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
            type="number"
            domain={['dataMin', 'dataMax']}
          />
          <YAxis
            yAxisId="left"
            label={{ value: 'CO₂ (g)', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: 'Energy (kWh)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip
            formatter={(value, name) => [
              value,
              name === 'CO₂ Emissions' ? 'CO₂ (g)' : 'Energy (kWh)',
            ]}
            labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="co2"
            stroke="#4CAF50"
            name="CO₂ Emissions"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="energy"
            stroke="#2196F3"
            name="Energy Usage"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}