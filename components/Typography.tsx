import React from "react";
import { cn } from "../lib/utils";

export function H1({ className, children, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1 className={cn("text-3xl font-black tracking-tight", className)} {...props}>
      {children}
    </h1>
  );
}

export function H2({ className, children, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-2xl font-bold tracking-tight", className)} {...props}>
      {children}
    </h2>
  );
}

export function H3({ className, children, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3 className={cn("text-xl font-bold tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
}

export function H4({ className, children, ...props }: React.ComponentProps<"h4">) {
  return (
    <h4 className={cn("text-lg font-semibold tracking-tight", className)} {...props}>
      {children}
    </h4>
  );
}

export function P({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("leading-7 text-slate-400 [&:not(:first-child)]:mt-6", className)} {...props}>
      {children}
    </p>
  );
}

export function Large({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-lg font-semibold", className)} {...props}>
      {children}
    </div>
  );
}

export function Small({ className, children, ...props }: React.ComponentProps<"small">) {
  return (
    <small className={cn("text-sm font-medium leading-none", className)} {...props}>
      {children}
    </small>
  );
}

export function Muted({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-slate-500", className)} {...props}>
      {children}
    </p>
  );
}

