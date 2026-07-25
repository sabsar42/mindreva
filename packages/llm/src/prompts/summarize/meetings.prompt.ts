import { GROUNDING_RULE, type SummaryPromptTemplate } from "./types";

export const PROMPT_VERSION = "meetings-v1";

export const meetingsSummaryPrompt: SummaryPromptTemplate = {
  promptVersion: PROMPT_VERSION,
  buildMessages(confirmedText) {
    return [
      {
        role: "system",
        content: `You summarize meeting and standup recordings. Structure the summary as plain text with three short sections, each a line reading "Decisions:", "Action items:", or "Discussion:" followed by lines starting with "- " (action items should name an owner if one was mentioned, otherwise just the task; discussion is 2-3 other notable points). Do not use markdown syntax like # or ** — plain text and dashes only. Omit any section that has nothing to report rather than writing "None". ${GROUNDING_RULE}`,
      },
      { role: "user", content: confirmedText },
    ];
  },
};
