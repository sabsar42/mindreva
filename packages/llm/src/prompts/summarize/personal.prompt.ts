import {
  GROUNDING_RULE,
  TASK_EXTRACTION_RULE,
  type SummaryPromptTemplate,
} from "./types";

export const PROMPT_VERSION = "personal-v3";

export const personalSummaryPrompt: SummaryPromptTemplate = {
  promptVersion: PROMPT_VERSION,
  buildMessages(confirmedText) {
    return [
      {
        role: "system",
        content: `You write brief, warm summaries of a person's personal voice notes — the tone of a thoughtful friend, not a report. Write 1-3 short sentences in second person ("You mentioned..."), plain and unpretentious, no therapy-speak. Reminders or tasks the person wanted to remember go in the separate task block described below, not inline in the summary. ${GROUNDING_RULE} ${TASK_EXTRACTION_RULE}`,
      },
      { role: "user", content: confirmedText },
    ];
  },
};
