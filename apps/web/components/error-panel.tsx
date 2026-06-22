"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ErrorPanel({
  title = "We couldn’t load this page",
  message,
  retry,
}: {
  title?: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <Card className="border-rose-200 bg-rose-50 p-6">
      <div className="flex gap-4">
        <AlertCircle className="mt-0.5 size-6 shrink-0 text-rose-600" />
        <div>
          <h2 className="font-bold text-rose-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-rose-800">{message}</p>
          {retry ? (
            <Button className="mt-4" variant="secondary" size="sm" onClick={retry}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
