import {
  GROUNDING_RULE,
  TASK_EXTRACTION_RULE,
  type SummaryPromptTemplate,
} from "./types";

export const PROMPT_VERSION = "general-v5";

export const generalSummaryPrompt: SummaryPromptTemplate = {
  promptVersion: PROMPT_VERSION,
  buildMessages(confirmedText) {
    return [
      {
        role: "system",
        content: `You write plain, neutral summaries of a person's voice journal or note entries. Write 2-4 sentences capturing what was said, in third person, calm and factual tone. No headings, no bullet points, no preamble like "Here is a summary" — just the summary itself. ${GROUNDING_RULE} ${TASK_EXTRACTION_RULE}`,
      },
      { role: "user", content: confirmedText },
    ];
  },
};
