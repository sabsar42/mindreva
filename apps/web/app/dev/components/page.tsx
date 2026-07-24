import { notFound } from "next/navigation";
import { ComponentsGallery } from "./gallery";

// Visual QA surface for the design system. Gated to non-production so it never
// ships to users. Delete this route (app/dev) before launch if desired.
export default function DevComponentsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <ComponentsGallery />;
}
