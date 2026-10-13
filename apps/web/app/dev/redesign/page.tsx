import { notFound } from "next/navigation";
import { RedesignGallery } from "./redesign-gallery";

// Visual QA surface for the Apple-inspired redesign pieces: every state of the
// new components with static sample data, so they can be reviewed without
// signing in. Gated to non-production, like /dev/components.
export default function DevRedesignPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <RedesignGallery />;
}
