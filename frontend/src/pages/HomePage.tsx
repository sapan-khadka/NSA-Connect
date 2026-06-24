import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
};

export function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/health")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Not Found");
        }

        return res.json() as Promise<HealthResponse>;
      })
      .then((data) => setHealth(data))
      .catch((err: Error) => setError(err.message ?? "Request failed"));
  }, []);

  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold text-primary">NSA Connect</h1>
      <p className="mt-2 text-gray-500">Nepalese Students&apos; Association</p>

      <section className="mx-auto mt-8 max-w-md rounded-lg border border-gray-200 bg-gray-50 p-6">
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
    </div>
  );
}
