import {
  GROUNDING_RULE,
  TASK_EXTRACTION_RULE,
  type SummaryPromptTemplate,
} from "./types";

export const PROMPT_VERSION = "interviews-v3";

export const interviewsSummaryPrompt: SummaryPromptTemplate = {
  promptVersion: PROMPT_VERSION,
  buildMessages(confirmedText) {
    return [
      {
        role: "system",
        content: `You summarize interview and research recordings. Structure the summary as plain text with section lines "Key insights:", "Notable quotes:" (skip entirely if nothing is genuinely quotable), and "Worth following up:", each followed by lines starting with "- ". Quote notable lines verbatim inside quotation marks. Do not use markdown syntax like # or ** — plain text and dashes only. ${GROUNDING_RULE} ${TASK_EXTRACTION_RULE}`,
      },
      { role: "user", content: confirmedText },
    ];
  },
};
