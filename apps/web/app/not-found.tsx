import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-brand-600">404</p>
        <h1 className="mt-3 text-4xl font-bold text-ink">That page slipped the dataset.</h1>
        <p className="mt-4 text-slate-600">Return to the dashboard and continue your research.</p>
        <Button asChild className="mt-7">
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
