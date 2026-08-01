type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="border-b border-surface-card pb-6">
      {eyebrow ? <p className="ds-section-label">{eyebrow}</p> : null}
      <h1 className="type-display mt-1 text-2xl tracking-headline text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-label">{description}</p>
      ) : null}
    </header>
  );
}
