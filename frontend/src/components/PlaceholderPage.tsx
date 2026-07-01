type PlaceholderPageProps = {
  title: string;
  description?: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-light tracking-headline text-foreground">{title}</h1>
      <p className="mt-3 text-label">
        {description ?? "Coming soon — placeholder page."}
      </p>
    </div>
  );
}
