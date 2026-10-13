import { redirect } from "next/navigation";

// The Mindmap now lives inside Past Self (compact, with an expand popup), so the
// old standalone screen is gone. This keeps any bookmark or old link working.
export default function MindmapPage() {
  redirect("/chat");
}
