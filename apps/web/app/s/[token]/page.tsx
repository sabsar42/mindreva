import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { JournalImage, LeafMark, cn } from "@mindreva/ui";
import { buttonVariants } from "@mindreva/ui/button-variants";
import { parseJournalMarkdown } from "@mindreva/types";
import { resolveSharedEntry } from "@/lib/services/shares.service";

// A share link is a capability URL: keep it out of search results, and don't
// leak it to other sites through the Referer header if the reader follows a link.
export const metadata: Metadata = {
  title: "Shared journal",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Per-viewer (it depends on who is signed in) and never cacheable.
export const dynamic = "force-dynamic";

function formatDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Brand() {
  return (
    <div className="text-primary flex items-center gap-2">
      <span className="bg-gradient-primary shadow-subtle flex size-8 items-center justify-center rounded-xl">
        <LeafMark className="text-primary-foreground size-4" />
      </span>
      <span className="font-serif text-base font-bold">Mindreva</span>
    </div>
  );
}

export default async function SharedEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await resolveSharedEntry(token);

  if (result.status === "not_found") notFound();

  if (result.status === "sign_in_required") {
    redirect(`/sign-in?redirectTo=${encodeURIComponent(`/s/${token}`)}`);
  }

  if (result.status === "forbidden") {
    return (
      <main className="min-h-app mx-auto flex flex-col justify-center px-6 py-12 text-center">
        <div className="mx-auto mb-5">
          <Brand />
        </div>
        <div className="border-border bg-card shadow-subtle flex flex-col items-center rounded-2xl border px-6 py-10">
          <span className="bg-secondary text-muted-foreground flex size-14 items-center justify-center rounded-[1.25rem]">
            <Lock className="size-6" />
          </span>
          <h1 className="text-foreground mt-5 text-xl font-bold tracking-tight">
            This journal is private
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-xs text-sm leading-relaxed">
            You&apos;re signed in, but this account hasn&apos;t been given
            access. Ask the person who shared it to add your email address, or
            sign in with the account they used.
          </p>
          <Link
            href={`/sign-in?redirectTo=${encodeURIComponent(`/s/${token}`)}`}
            className={cn(buttonVariants({ variant: "secondary" }), "mt-5")}
          >
            Use a different account
          </Link>
        </div>
      </main>
    );
  }

  const { entry, viewerIsOwner } = result;
  const blocks = parseJournalMarkdown(entry.body);
  const date = formatDate(entry.entryDate);

  return (
    <main className="min-h-app mx-auto px-4 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <Brand />
        <span className="text-muted-foreground text-xs">Shared journal</span>
      </header>

      {viewerIsOwner && (
        <p className="bg-secondary text-secondary-foreground mt-4 rounded-2xl px-4 py-3 text-sm">
          This is how others see your journal.{" "}
          <Link
            href="/journal"
            className="text-primary font-semibold underline"
          >
            Back to Mindreva
          </Link>
        </p>
      )}

      {date && <p className="text-muted-foreground mt-6 text-sm">{date}</p>}
      <h1 className="text-foreground mt-1 text-3xl font-bold leading-tight tracking-tight">
        {entry.title?.trim() || "Untitled entry"}
      </h1>

      {entry.coverUrl && (
        <div className="mt-5">
          {/* Signed, short-lived URL: a plain <img>, like the rest of the app. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.coverUrl}
            alt=""
            className="h-48 w-full rounded-2xl object-cover"
          />
        </div>
      )}

      {entry.imagesUnavailable && (
        <p className="text-muted-foreground bg-secondary mt-5 rounded-2xl px-4 py-3 text-xs">
          Some pictures in this journal can&apos;t be shown right now.
        </p>
      )}

      {/* flow-root contains floated pictures so the footer never rides up
          beside them. */}
      <article className="text-foreground mt-6 flow-root text-[1.0625rem] leading-[1.75]">
        {blocks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            There&apos;s nothing written here yet.
          </p>
        ) : (
          blocks.map((block, i) => {
            if (block.type === "image") {
              const src = entry.imageUrls[block.photoId];
              return src ? (
                <JournalImage
                  key={i}
                  src={src}
                  alt={block.alt}
                  size={block.size}
                  align={block.align}
                />
              ) : null;
            }
            return (
              <p key={i} className="mb-3 whitespace-pre-wrap last:mb-0">
                {block.inline.map((run, j) => (
                  <span
                    key={j}
                    className={cn(
                      run.bold && "font-bold",
                      run.italic && "italic",
                    )}
                  >
                    {run.text}
                  </span>
                ))}
              </p>
            );
          })
        )}
      </article>

      <footer className="border-border mt-12 flex flex-col items-center gap-3 border-t pt-6 text-center">
        <p className="text-muted-foreground text-sm">
          Written with Mindreva, a voice journal that keeps what you say.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          Try Mindreva
        </Link>
      </footer>
    </main>
  );
}
