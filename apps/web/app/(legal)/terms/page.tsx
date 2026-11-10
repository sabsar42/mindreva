import type { Metadata } from "next";
import { contactEmail, supportUrl, supportWidget } from "@/lib/support";
import { Bullets, LegalTitle, Section } from "../_components/legal";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  const email = contactEmail();
  const hasSupport = supportUrl() !== null || supportWidget() !== null;

  return (
    <>
      <LegalTitle
        title="Terms"
        intro="Plain-language rules for using Mindreva. By creating an account or using the app, you agree to them."
      />

      <Section title="Using Mindreva">
        <Bullets>
          <li>
            You&apos;re responsible for your account and for keeping your login
            safe.
          </li>
          <li>
            Only record other people where you&apos;re allowed to, and tell them
            where the law or good manners require it.
          </li>
          <li>
            Don&apos;t use Mindreva for anything unlawful, to harm others, to
            overload it, or to try to break its security.
          </li>
        </Bullets>
      </Section>

      <Section title="Your content">
        <p>
          What you record and write is yours. You let Mindreva store it and
          process it, including sending audio and text to the AI services
          described on the Privacy page, because that is how the app works.
        </p>
      </Section>

      <Section title="AI can be wrong">
        <p>
          Transcripts, summaries, tasks and Past Self answers are produced by AI
          and can contain mistakes. Check anything that matters. Mindreva
          isn&apos;t medical, legal or financial advice, and it isn&apos;t a
          therapy or crisis service. If you&apos;re in danger or need urgent
          help, contact local emergency services.
        </p>
      </Section>

      <Section title="Free, with nothing locked">
        <p>
          Mindreva has no paid plans.
          {hasSupport
            ? " The “Support Mindreva” link and tip button are a voluntary gift. It doesn't unlock features, raise any limit or buy priority, and the app works exactly the same whether or not you use it."
            : " Nothing in the app depends on payment."}{" "}
          Services behind the app can run into their own daily limits; when that
          happens we tell you, nothing is lost, and it works again later.
        </p>
      </Section>

      <Section title="As is">
        <p>
          Mindreva is provided as it is, without promises that it will always be
          available or error-free. Features may change or end. Keep a copy of
          anything you can&apos;t afford to lose.
        </p>
      </Section>

      <Section title="Ending">
        <p>
          You can stop using Mindreva whenever you like. We may suspend access
          for misuse or to protect the service and other people.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If these terms change in a way that matters, we&apos;ll update the
          date at the top of this page.
        </p>
      </Section>

      {email && (
        <Section title="Questions">
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
    </>
  );
}
