import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 dark:focus-visible:ring-neutral-300 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#9e2339] text-white shadow hover:bg-[#7a1b2d]",
        destructive:
          "bg-red-500 text-white shadow-sm hover:bg-red-500/90",
        success:
          "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
        outline:
          "border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 shadow-sm hover:bg-gray-100 dark:hover:bg-neutral-600 text-gray-900 dark:text-neutral-100",
        secondary:
          "bg-gray-100 dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 shadow-sm hover:bg-gray-200 dark:hover:bg-neutral-600",
        ghost: "hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 hover:text-gray-900 dark:hover:text-neutral-100",
        link: "text-gray-900 dark:text-neutral-100 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
