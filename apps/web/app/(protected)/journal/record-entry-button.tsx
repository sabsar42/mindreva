"use client";

import { useRouter } from "next/navigation";
import { RecordButton } from "@mindreva/ui";

export function RecordEntryButton() {
  const router = useRouter();
  return <RecordButton state="idle" onClick={() => router.push("/record")} />;
}
