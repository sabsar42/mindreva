import { LeafMark } from "@mindreva/ui";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <div className="mb-8 flex justify-center">
        <LeafMark className="text-primary size-8" />
      </div>
      {children}
    </main>
  );
}
