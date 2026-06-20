import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="text-center">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="mt-4 text-gray-500">Page not found.</p>
      <Link
        to="/"
        className="mt-6 inline-block text-accent hover:text-accent-hover"
      >
        Back to home
      </Link>
    </div>
  );
}
