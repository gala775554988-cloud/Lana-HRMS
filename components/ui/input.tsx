import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-all duration-300 ease-premium placeholder:text-muted-foreground hover:border-primary/30 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:shadow-premium-sm disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
