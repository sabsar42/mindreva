import { ExternalLink, Heart } from "lucide-react";
import { SettingsRow } from "@mindreva/ui";
import { supportUrl } from "@/lib/support";

/**
 * "Support Mindreva": a voluntary link out to a tip page. It opens in a new tab
 * and unlocks nothing; the copy says so. Renders nothing when
 * NEXT_PUBLIC_SUPPORT_URL is not set.
 */
export function SupportRow() {
  const url = supportUrl();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:bg-secondary focus-visible:ring-ring block transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
    >
      <SettingsRow
        icon={<Heart />}
        title="Support Mindreva"
        description="Entirely voluntary. It unlocks nothing: every feature is free for everyone."
        trailing={<ExternalLink className="text-muted-foreground size-4" />}
      />
    </a>
  );
}

/** The small footer version. Same rules: new tab, nothing gated, hidden if unset. */
export function SupportFooterLink({ className }: { className?: string }) {
  const url = supportUrl();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Voluntary. It unlocks nothing."
      className={className}
    >
      Support Mindreva
    </a>
  );
}
