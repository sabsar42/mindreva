"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

export interface TaskChecklistTask {
  id: string;
  text: string;
  isDone: boolean;
}

export interface TaskChecklistProps {
  tasks: TaskChecklistTask[];
  /** Fires with the task id and its new done state. Persisting the change is
   * the caller's job — this component is presentation-only, same as every
   * other packages/ui component that touches app data. */
  onToggle: (taskId: string, isDone: boolean) => void;
  className?: string;
}

/**
 * A checklist of extracted action items, each independently toggleable.
 * Renders nothing when there are no tasks — an entry without action items
 * simply has no checklist section, not an empty box.
 */
function TaskChecklist({ tasks, onToggle, className }: TaskChecklistProps) {
  if (tasks.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            onClick={() => onToggle(task.id, !task.isDone)}
            aria-pressed={task.isDone}
            className="group flex w-full items-start gap-2.5 text-left"
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                task.isDone
                  ? "bg-primary border-primary"
                  : "border-border bg-card group-hover:border-gray-500",
              )}
            >
              {task.isDone && (
                <Check className="text-primary-foreground size-3.5" />
              )}
            </span>
            <span
              className={cn(
                "text-sm leading-snug",
                task.isDone
                  ? "text-muted-foreground line-through"
                  : "text-foreground",
              )}
            >
              {task.text}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export { TaskChecklist };
