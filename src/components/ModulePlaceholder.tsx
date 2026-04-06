type ModulePlaceholderProps = {
  title: string;
  description?: string;
};

export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-2 text-neutral-600 text-sm dark:text-neutral-400">
          {description}
        </p>
      ) : null}
    </main>
  );
}
