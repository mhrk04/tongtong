export function BillPageState({
  heading,
  description,
}: {
  heading?: string;
  description?: string;
}) {
  return (
    <main
      className={`mx-auto max-w-2xl px-6 py-16 text-center${heading ? "" : " text-sm text-muted"}`}
    >
      {heading && <h1 className="text-2xl font-black">{heading}</h1>}
      {heading && description && (
        <p className="mt-2 text-sm text-muted">{description}</p>
      )}
      {!heading && description}
    </main>
  );
}
