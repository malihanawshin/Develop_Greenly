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
        const response = await fetch('https://3acb5b4a3a26.ngrok-free.app/api/green-metrics', { // ngrok URL 
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true', // bypass ngrok warning
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