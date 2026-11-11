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
   * the caller's job — this component is presentation-only. */
  onToggle: (taskId: string, isDone: boolean) => void;
  className?: string;
}

function TaskChecklist({ tasks, onToggle, className }: TaskChecklistProps) {
  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((t) => t.isDone).length;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
          To-do
        </p>
        <p className="text-muted-foreground text-xs font-semibold tabular-nums">
          {doneCount} of {tasks.length} done
        </p>
      </div>
      <ul className="bg-card border-border shadow-subtle divide-border divide-y overflow-hidden rounded-2xl border">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onToggle(task.id, !task.isDone)}
              aria-pressed={task.isDone}
              className="active:bg-secondary flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                  task.isDone
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40",
                )}
              >
                {task.isDone && (
                  <Check
                    className="text-primary-foreground size-3.5"
                    strokeWidth={3}
                  />
                )}
              </span>
              <span
                className={cn(
                  "text-[0.9375rem] leading-snug transition-colors",
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
    </div>
  );
}

export { TaskChecklist };
