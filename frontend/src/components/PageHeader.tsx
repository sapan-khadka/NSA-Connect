type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="border-b border-slate-200 pb-6">
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-1 text-2xl font-bold text-primary">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-gray-600">{description}</p>
      ) : null}
    </header>
  );
}
