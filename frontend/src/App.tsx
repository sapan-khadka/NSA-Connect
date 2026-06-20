import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-4xl font-bold text-primary">NSA Connect</h1>
      <p className="mt-2 text-gray-500">Nepalese Students&apos; Association</p>

      <section className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          API Status
        </h2>
        {health && (
          <p className="mt-2 font-medium text-green-700">Backend: {health.status}</p>
        )}
        {error && (
          <p className="mt-2 font-medium text-red-600">Backend: {error}</p>
        )}
        {!health && !error && (
          <p className="mt-2 text-gray-400">Checking backend...</p>
        )}
      </section>
    </main>
  );
}

export default App;
