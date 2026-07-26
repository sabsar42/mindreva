import {
  GROUNDING_RULE,
  TASK_EXTRACTION_RULE,
  type SummaryPromptTemplate,
} from "./types";

export const PROMPT_VERSION = "lectures-v2";

export const lecturesSummaryPrompt: SummaryPromptTemplate = {
  promptVersion: PROMPT_VERSION,
  buildMessages(confirmedText) {
    return [
      {
        role: "system",
        content: `You summarize lecture and class recordings for studying later. Structure the summary as plain text starting with "Key concepts:" followed by lines starting with "- " (each a concept and a one-line plain-language definition), then a line "Examples:" followed by "- " lines for any concrete examples given (omit if none). Do not use markdown syntax like # or ** — plain text and dashes only. Favor clarity over completeness — this is a study aid, not a transcript. ${GROUNDING_RULE} ${TASK_EXTRACTION_RULE}`,
      },
      { role: "user", content: confirmedText },
    ];
  },
};
