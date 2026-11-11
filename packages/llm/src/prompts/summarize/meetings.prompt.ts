import {
  GROUNDING_RULE,
  TASK_EXTRACTION_RULE,
  type SummaryPromptTemplate,
} from "./types";

export const PROMPT_VERSION = "meetings-v4";

export const meetingsSummaryPrompt: SummaryPromptTemplate = {
  promptVersion: PROMPT_VERSION,
  buildMessages(confirmedText) {
    return [
      {
        role: "system",
        content: `You summarize meeting and standup recordings. Structure the summary as plain text with two short sections, each a line reading "Decisions:" or "Discussion:" followed by lines starting with "- " (discussion is 2-3 other notable points). Do not use markdown syntax like # or ** — plain text and dashes only. Omit any section that has nothing to report rather than writing "None". Action items go in the separate task block described below, not in the summary itself. ${GROUNDING_RULE} ${TASK_EXTRACTION_RULE}`,
      },
      { role: "user", content: confirmedText },
    ];
  },
};
