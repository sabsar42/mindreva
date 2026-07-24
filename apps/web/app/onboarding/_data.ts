export const LANGUAGE_OPTIONS = [
  { code: "bn", label: "বাংলা (Bangla)" },
  { code: "ur", label: "اردو (Urdu)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "en", label: "English" },
] as const;

export const USE_CASE_OPTIONS = [
  {
    value: "general",
    title: "General",
    description: "A plain summary of what was said",
  },
  {
    value: "meetings",
    title: "Meetings & standups",
    description: "Outcomes, decisions, and who does what",
  },
  {
    value: "interviews",
    title: "Interviews & research",
    description: "Key answers, insights, and quotes",
  },
  {
    value: "lectures",
    title: "Lectures & classes",
    description: "Concepts, definitions, and examples",
  },
  {
    value: "personal",
    title: "Personal voice notes",
    description: "Warm, brief, surfaces your reminders",
  },
] as const;
