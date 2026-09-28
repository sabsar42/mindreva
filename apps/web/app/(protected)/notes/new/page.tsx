"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, toast } from "@mindreva/ui";
import { PageHeader } from "../../_components/page-header";

export default function NewNotePage() {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type: "note" }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = (await res.json()) as { entryId: string };
      router.push(`/entries/${data.entryId}`);
    } catch {
      toast.error("Couldn't save your note. Please try again.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen flex-col px-5 pb-6 pt-6 md:max-w-2xl">
      <PageHeader title="New note" />

      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write what's on your mind…"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            void handleSave();
          }
        }}
        className="text-foreground placeholder:text-muted-foreground mt-6 flex-1 resize-none bg-transparent text-base leading-relaxed outline-none"
      />

      <Button
        className="mt-6 w-full"
        onClick={handleSave}
        disabled={!text.trim() || saving}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    </main>
  );
}
