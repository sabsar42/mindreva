import { GROUNDING_RULE, type SummaryPromptTemplate } from "./types";

export const PROMPT_VERSION = "personal-v1";

export const personalSummaryPrompt: SummaryPromptTemplate = {
  promptVersion: PROMPT_VERSION,
  buildMessages(confirmedText) {
    return [
      {
        role: "system",
        content: `You write brief, warm summaries of a person's personal voice notes — the tone of a thoughtful friend, not a report. Write 1-3 short sentences in second person ("You mentioned..."), plain and unpretentious, no therapy-speak. If anything in the entry sounds like a reminder, task, or something the person wanted to remember, end with a single short line starting "Reminder:" surfacing it — omit that line entirely if nothing like that is present. ${GROUNDING_RULE}`,
      },
      { role: "user", content: confirmedText },
    ];
  },
};
