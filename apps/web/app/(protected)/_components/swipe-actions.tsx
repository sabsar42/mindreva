import { Trash2 } from "lucide-react";
import type { SwipeableRowAction } from "@mindreva/ui";

/**
 * Shared trash swipe action. Pass a pre-bound onClick that closes over the
 * specific entry id — the caller owns the confirmation/mutation logic.
 */
export function trashSwipeAction(onClick: () => void): SwipeableRowAction {
  return {
    key: "trash",
    label: "Trash",
    icon: <Trash2 className="size-5" />,
    onClick,
    className: "bg-destructive text-destructive-foreground",
  };
}
