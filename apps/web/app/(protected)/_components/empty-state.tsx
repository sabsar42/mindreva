import { cn } from "@mindreva/ui";

interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border rounded-xl border border-dashed py-12 text-center",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
