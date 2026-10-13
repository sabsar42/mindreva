/**
 * Re-mounts on every navigation within the protected area (unlike layout.tsx),
 * which is what lets each screen ease in. Opacity plus a few px of rise, 220ms,
 * `backwards` fill so no transform lingers afterwards (a leftover transform
 * would become a containing block for fixed/sticky children). Disabled under
 * prefers-reduced-motion.
 */
export default function ProtectedTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="motion-safe:animate-page-in">{children}</div>;
}
