export default function Loading() {
  return (
    <div className="min-h-screen bg-paper p-8">
      <div className="mx-auto max-w-6xl animate-pulse space-y-7">
        <div className="h-12 w-72 rounded-xl bg-slate-200" />
        <div className="h-6 w-full max-w-xl rounded-lg bg-slate-200" />
        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-44 rounded-2xl bg-white shadow-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
