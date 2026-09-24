import { SideNav } from "./_components/side-nav";
import { BottomNav } from "./_components/bottom-nav";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Desktop/tablet sidebar — hidden on mobile */}
      <SideNav />

      {/* Offset main content away from the fixed sidebar on md+ */}
      <div className="md:ml-14 lg:ml-56">{children}</div>

      {/* Mobile bottom nav — hidden on md+ */}
      <BottomNav />
    </>
  );
}
