import React, { useEffect, useState } from 'react';
import CarbonChart from '../components/CarbonChart';

export default function Dashboard() {
  const [metrics, setMetrics] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('http://18.185.23.135:3000/api/green-metrics', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
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

        const data = await response.json();
        console.log('fetched data:', data);
        setMetrics(data);
      } catch (error) {
        console.error('fetch error:', error.message);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Green Dev Dashboard 🌱</h1>
      {isLoading && <div>Loading...</div>}
      {error && (
        <div className="text-red-500">
          Error: {error}
          <button
            onClick={fetchMetrics}
            className="ml-4 p-2 bg-blue-500 text-white rounded"
          >
            Retry
          </button>
        </div>
      )}
      {!isLoading && !error && <CarbonChart data={metrics} />}
    </div>
  );
}