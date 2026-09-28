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
    <div className={cn("", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
          Tasks
        </p>
        <p className="text-muted-foreground text-xs font-semibold">
          {doneCount}/{tasks.length}
        </p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onToggle(task.id, !task.isDone)}
              aria-pressed={task.isDone}
              className="bg-card border-border hover:border-primary/40 group flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                  task.isDone
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 group-hover:border-primary/60",
                )}
              >
                {task.isDone && (
                  <Check
                    className="text-primary-foreground size-3"
                    strokeWidth={3}
                  />
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
    </div>
  );
}

export { TaskChecklist };
