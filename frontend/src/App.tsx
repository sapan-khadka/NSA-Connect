import { useEffect, useState } from "react";
import "./App.css";

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
    <main className="app">
      <h1>NSA Connect</h1>
      <p className="subtitle">Nepalese Students&apos; Association</p>

      <section className="status-card">
        <h2>API Status</h2>
        {health && <p className="ok">Backend: {health.status}</p>}
        {error && <p className="error">Backend: {error}</p>}
        {!health && !error && <p>Checking backend...</p>}
      </section>
    </main>
  );
}

export default App;
