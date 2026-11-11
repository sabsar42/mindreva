import type { Metadata } from "next";
import { contactEmail, supportUrl, supportWidget } from "@/lib/support";
import { Bullets, LegalTitle, Section } from "../_components/legal";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  const email = contactEmail();
  const hasSupport = supportUrl() !== null;
  const widget = supportWidget() !== null;

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
            <strong>Language-model services</strong> receive your <em>text</em>.
            OpenRouter is used first: it passes the text to a free model from
            one of several AI companies to write summaries, titles and tasks,
            name themes, and answer Past Self questions. When OpenRouter
            can&apos;t answer, Groq is used instead. Google Gemini or Anthropic
            Claude can be configured instead of either.
          </li>
          <li>
            <strong>A search service</strong> (an embedding model reached
            through OpenRouter) receives your <em>entry text</em> and your Past
            Self questions, and turns them into numbers so the app can find the
            entries that relate to a question. Those numbers are stored with
            your entries.
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

      <Section title="Google Calendar (optional)">
        <p>
          If you choose to connect Google Calendar, Mindreva asks Google to read
          your calendars (the <code>calendar.readonly</code> permission), to
          create events (the <code>calendar.events</code> permission) and for
          your Google account email. It reads event titles, times and calendar
          names to show that day&apos;s events beside your entries, on Home and
          in Re-live Me. It creates an event only when you tap &quot;Add to
          calendar&quot; on a date it found in one of your entries, and it never
          changes or deletes events that are already there.
        </p>
        <p>
          Events are fetched when you open a screen and held briefly in memory
          (a few minutes); they are not stored in our database. We store one
          thing: an encrypted refresh token that lets Mindreva keep reading the
          calendars you picked, plus your Google email and which calendars are
          on. Calendar data is never sent to an AI model and never used for ads.
        </p>
        <p>
          Disconnect any time in <strong>Account &rarr; Google Calendar</strong>
          : we revoke the access with Google and delete the stored token.
          Deleting your account does the same. You can also remove access from
          your Google Account&apos;s security settings. Mindreva&apos;s use of
          information received from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hit-44 underline-offset-2 hover:underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </Section>

      <Section title="Deleting things">
        <p>
          Moving an entry to Trash hides it and keeps it recoverable; nothing is
          permanently erased from Trash yet.
        </p>
        <p>
          You can delete your whole account at any time from{" "}
          <strong>Account &rarr; Delete account</strong>. That permanently
          erases your account and everything in it straight away: entries,
          recordings, transcripts, summaries, pictures, conversations, share
          links and search data. Copies can remain in our providers&apos;
          backups for a short time before those expire.
          {email
            ? " To ask for a copy of your data, email the address below."
            : ""}
        </p>
      </Section>

      {(hasSupport || widget) && (
        <Section title="The support link">
          <p>
            The optional “Support Mindreva” link and tip button open another
            website, SupportKori, which has its own rules and its own privacy
            policy. On the Account screen the tip button loads a small script
            and panel from that site; it is not loaded anywhere else in the app.
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
