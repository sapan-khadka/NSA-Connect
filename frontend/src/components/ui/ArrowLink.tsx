import { Link } from "react-router-dom";

type ArrowLinkProps = {
  to: string;
  children: string;
  className?: string;
};

export function ArrowLink({ to, children, className = "" }: ArrowLinkProps) {
  return (
    <Link to={to} className={["ds-link", className].join(" ")}>
      {children} ›
    </Link>
  );
}
