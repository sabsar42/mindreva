import { LeafMark } from "@mindreva/ui";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-app mx-auto flex max-w-md flex-col px-6 py-10">
      <div className="mb-8 flex justify-center">
        <LeafMark className="text-primary size-8" />
      </div>
      {children}
    </main>
  );
}
