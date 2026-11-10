import type { SummaryStyle } from "../../types";
import type { SummaryPromptTemplate } from "./types";
import { generalSummaryPrompt } from "./general.prompt";
import { meetingsSummaryPrompt } from "./meetings.prompt";
import { interviewsSummaryPrompt } from "./interviews.prompt";
import { lecturesSummaryPrompt } from "./lectures.prompt";
import { personalSummaryPrompt } from "./personal.prompt";

const SUMMARY_PROMPTS: Record<SummaryStyle, SummaryPromptTemplate> = {
  general: generalSummaryPrompt,
  meetings: meetingsSummaryPrompt,
  interviews: interviewsSummaryPrompt,
  lectures: lecturesSummaryPrompt,
  personal: personalSummaryPrompt,
};

/** Falls back to "general" for an unknown/legacy style rather than throwing. */
export function resolveSummaryPrompt(style: string): SummaryPromptTemplate {
  return SUMMARY_PROMPTS[style as SummaryStyle] ?? SUMMARY_PROMPTS.general;
}

export { parseTaskBlock, parseTitleLine } from "./types";
export type { SummaryPromptTemplate } from "./types";
