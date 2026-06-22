import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
        secondary: "border border-slate-200 bg-white text-ink hover:bg-slate-50",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-ink",
        teal: "bg-teal-600 text-white hover:bg-teal-500",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3",
        lg: "h-13 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
