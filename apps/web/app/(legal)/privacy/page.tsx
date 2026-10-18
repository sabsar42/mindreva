import type { Metadata } from "next";
import { contactEmail, supportUrl } from "@/lib/support";
import { Bullets, LegalTitle, Section } from "../_components/legal";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  const email = contactEmail();
  const hasSupport = supportUrl() !== null;

  return (
    <>
      <LegalTitle
        title="Privacy"
        intro="Mindreva keeps what you record and write so it can be there when you come back. This page says what that is, who handles it, and what we don't do."
      />

      <Section title="The short version">
        <Bullets>
          <li>
            Your entries are <strong>private to you</strong> unless you share
            one yourself.
          </li>
          <li>
            We <strong>don&apos;t sell your data</strong>, show ads, or build
            advertising profiles.
          </li>
          <li>
            Your audio and text are sent to <strong>AI services</strong> to be
            transcribed and summarised. That is how the app works.
          </li>
          <li>
            Nothing in Mindreva is locked behind payment, and no payment details
            pass through it.
          </li>
        </Bullets>
      </Section>

      <Section title="What we keep">
        <Bullets>
          <li>
            <strong>Your account:</strong> email address, display name and a
            password (stored by our login provider as a hash; we never see it).
          </li>
          <li>
            <strong>Your entries:</strong> voice recordings, transcripts (the
            original and your edits), titles, summaries, tasks, and pictures you
            add.
          </li>
          <li>
            <strong>Your activity:</strong> the days you opened the app or made
            a recording, which draw your activity graph and streak.
          </li>
          <li>
            <strong>Past Self conversations:</strong> the questions you ask and
            the answers you get.
          </li>
          <li>
            <strong>Preferences:</strong> language, summary style, and which
            integrations you connect. Your theme and Mori&apos;s quiet mode stay
            on your device only.
          </li>
        </Bullets>
      </Section>

      <Section title="Who handles it">
        <p>
          Mindreva relies on a few services. Each one sees only what it needs:
        </p>
        <Bullets>
          <li>
            <strong>Supabase</strong> stores the database, logins and files
            (recordings and pictures).
          </li>
          <li>
            <strong>A speech-to-text service</strong> (Groq by default, Hugging
            Face as a fallback) receives your <em>audio</em> to transcribe it.
          </li>
          <li>
            <strong>A language-model service</strong> (OpenRouter by default;
            Google Gemini, Anthropic Claude or Groq can be used instead)
            receives your <em>transcript text</em> to write summaries, titles
            and tasks, to name themes, to make search possible, and to answer
            Past Self questions.
          </li>
          <li>
            <strong>Vercel</strong> hosts the app.
          </li>
          <li>
            <strong>Sentry</strong>, only if error monitoring is switched on for
            this deployment, receives error reports and short session replays
            with text and media masked.
          </li>
        </Bullets>
        <p>Each of them has its own privacy policy.</p>
      </Section>

      <Section title="Sharing">
        <p>
          Only you can see your entries. If you share one, by link or with
          specific people, they can see that entry (and its pictures) until you
          stop sharing it. Anyone who has a public link can open it.
        </p>
      </Section>

      <Section title="Deleting things">
        <p>
          Moving an entry to Trash hides it and keeps it recoverable; nothing is
          permanently erased from Trash yet.
          {email
            ? " To have your account and everything in it deleted, or to ask for a copy of your data, email the address below."
            : ""}
        </p>
      </Section>

      {hasSupport && (
        <Section title="The support link">
          <p>
            The optional “Support Mindreva” link opens another website in a new
            tab. That site has its own rules and its own privacy policy.
            Mindreva doesn&apos;t see what you do there, and supporting changes
            nothing about what you can do in the app.
          </p>
        </Section>
      )}

      {email && (
        <Section title="Questions and requests">
          <p>
            Email{" "}
            <a
              href={`mailto:${email}`}
              className="text-primary font-semibold underline underline-offset-2"
            >
              {email}
            </a>
            .
          </p>
        </Section>
      )}

      <Section title="Changes">
        <p>
          If this changes in a way that matters, we&apos;ll update the date at
          the top of this page.
        </p>
      </Section>
    </>
  );
}
