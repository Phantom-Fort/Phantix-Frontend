import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-foreground",
        outline: "border-border bg-transparent text-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
        warning: "border-amber-400/30 bg-amber-400/10 text-amber-400",
        destructive: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
