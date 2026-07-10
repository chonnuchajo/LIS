import * as React from "react";

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  onOpen?: () => void;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='menuitem']",
  "[role='option']",
  "[contenteditable='true']",
  "[data-card-open-ignore]",
].join(",");

function isIgnoredOpenTarget(target: EventTarget | null, currentTarget: HTMLElement) {
  if (!(target instanceof HTMLElement)) return false;
  const match = target.closest(INTERACTIVE_SELECTOR);
  return Boolean(match && currentTarget.contains(match) && match !== currentTarget);
}

function shouldOpenFromKey(key: string) {
  return key === "Enter" || key === " ";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      onOpen,
      onClick,
      onDoubleClick,
      onKeyDown,
      role,
      tabIndex,
      children,
      ...props
    },
    ref,
  ) => {
    const interactive = typeof onOpen === "function";
    const hasTextOnlyChildren = React.Children.toArray(children).every((child) => {
      return typeof child === "string" || typeof child === "number";
    });

    return (
      <div
        ref={ref}
        role={interactive && hasTextOnlyChildren ? role ?? "button" : role}
        tabIndex={interactive ? tabIndex ?? 0 : tabIndex}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          interactive &&
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!interactive || event.defaultPrevented || isIgnoredOpenTarget(event.target, event.currentTarget)) return;
          onOpen();
        }}
        onDoubleClick={(event) => {
          onDoubleClick?.(event);
          if (!interactive || event.defaultPrevented || isIgnoredOpenTarget(event.target, event.currentTarget)) return;
          onOpen();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!interactive || event.defaultPrevented || !shouldOpenFromKey(event.key)) return;
          if (isIgnoredOpenTarget(event.target, event.currentTarget)) return;
          event.preventDefault();
          onOpen();
        }}
        {...props}
        {...{ children }}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-4 sm:p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-4 sm:p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
