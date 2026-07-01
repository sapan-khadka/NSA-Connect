import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="text-center">
      <h1 className="text-6xl font-light tracking-headline text-foreground">404</h1>
      <p className="mt-4 text-label">Page not found.</p>
      <Link
        to="/"
        className="mt-6 inline-block text-accent"
      >
        Back to home
      </Link>
    </div>
  );
}
