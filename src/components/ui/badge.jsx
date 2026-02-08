import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-950 dark:focus:ring-neutral-300 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gray-900 dark:bg-neutral-100 text-gray-50 dark:text-neutral-900 shadow hover:bg-gray-900/80 dark:hover:bg-neutral-200",
        secondary:
          "border-transparent bg-gray-100 dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 hover:bg-gray-200 dark:hover:bg-neutral-600",
        destructive:
          "border-transparent bg-red-500 text-white shadow hover:bg-red-500/80",
        outline: "text-gray-950 dark:text-neutral-100 border-gray-200 dark:border-neutral-600",
        success:
          "border-transparent bg-green-500 text-white shadow hover:bg-green-500/80",
        warning:
          "border-transparent bg-amber-500 text-white shadow hover:bg-amber-500/80",
        processing:
          "border-transparent bg-blue-500 dark:bg-blue-600 text-white shadow hover:bg-blue-500/80 dark:hover:bg-blue-600/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
