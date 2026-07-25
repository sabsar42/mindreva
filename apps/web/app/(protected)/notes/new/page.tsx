"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Textarea, toast } from "@mindreva/ui";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-5 py-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-foreground hover:bg-warm-100 -ml-2 rounded-full p-2 transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">New note</h1>
      </header>

      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write what's on your mind…"
        className="min-h-[60vh] flex-1"
      />

      <Button onClick={handleSave} disabled={!text.trim() || saving}>
        {saving ? "Saving…" : "Save note"}
      </Button>
    </main>
  );
}
