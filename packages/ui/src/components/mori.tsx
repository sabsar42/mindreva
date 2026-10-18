"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Mori's moods. The first four describe how the user's week is going; the
 * last three are live reactions to what the user is doing right now.
 */
export type MoriMood =
  | "sleepy"
  | "calm"
  | "happy"
  | "thriving"
  | "listening"
  | "thinking"
  | "celebrating";

export interface MoriProps extends Omit<React.ComponentProps<"svg">, "ref"> {
  mood: MoriMood;
  /** Quiet mode: the face still changes, but nothing moves. */
  still?: boolean;
  /** Bump this number to make Mori hop (a reaction that isn't a mood change). */
  pulse?: number;
}

/**
 * Mori, the leaf companion. Every face is always in the DOM and cross-fades
 * (opacity + a small scale) when the mood changes, so a change of state reads
 * as a gentle shift rather than a swap. Colors come from the theme: a green
 * body with a light face in light mode, a mint body with a dark face in dark
 * mode. All motion lives in tokens.css (`.mori-*`) so it honours
 * prefers-reduced-motion with everything else.
 */
const Mori = React.forwardRef<SVGSVGElement, MoriProps>(
  ({ mood, still = false, pulse = 0, className, ...props }, ref) => {
    const innerRef = React.useRef<SVGSVGElement | null>(null);
    const lastMood = React.useRef(mood);
    const lastPulse = React.useRef(pulse);

    // A hop on every mood change and every pulse bump, never on first paint.
    React.useEffect(() => {
      const el = innerRef.current;
      if (!el || still) {
        lastMood.current = mood;
        lastPulse.current = pulse;
        return;
      }
      if (lastMood.current !== mood || lastPulse.current !== pulse) {
        el.classList.remove("mori-hop");
        void el.getBoundingClientRect();
        el.classList.add("mori-hop");
      }
      lastMood.current = mood;
      lastPulse.current = pulse;
    }, [mood, pulse, still]);

    return (
      <svg
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        viewBox="0 0 64 64"
        aria-hidden
        data-mood={mood}
        data-still={still || undefined}
        className={cn("mori size-14 overflow-visible", className)}
        onAnimationEnd={(e) => {
          if (e.animationName === "mori-hop") {
            innerRef.current?.classList.remove("mori-hop");
          }
        }}
        {...props}
      >
        {/* Effects that live around the body */}
        <g className="mori-fx fx-sparks">
          <path
            className="mori-spark"
            d="M8 12l1.5 3.2L12.7 16.7 9.5 18.2 8 21.4 6.5 18.2 3.3 16.7 6.5 15.2z"
          />
          <path
            className="mori-spark"
            style={{ animationDelay: "-.5s" }}
            d="M57 18l1.2 2.6 2.6 1.2-2.6 1.2L57 25.6l-1.2-2.6-2.6-1.2 2.6-1.2z"
          />
          <path
            className="mori-spark"
            style={{ animationDelay: "-1s" }}
            d="M54 4l.9 2 2 .9-2 .9L54 9.8l-.9-2-2-.9 2-.9z"
          />
        </g>
        <g className="mori-fx fx-zz">
          <text x="45" y="14" fontSize="11">
            z
          </text>
          <text x="53" y="7" fontSize="8">
            z
          </text>
        </g>
        <g className="mori-fx fx-waves">
          <path className="mori-wave" d="M9 33q-4 7 0 14" />
          <path
            className="mori-wave"
            style={{ animationDelay: "-.4s" }}
            d="M4 30q-7 10 0 20"
          />
          <path className="mori-wave" d="M55 33q4 7 0 14" />
          <path
            className="mori-wave"
            style={{ animationDelay: "-.4s" }}
            d="M60 30q7 10 0 20"
          />
        </g>
        <g className="mori-fx fx-dots">
          <circle className="mori-dot" cx="47" cy="12" r="2" />
          <circle
            className="mori-dot"
            style={{ animationDelay: "-.3s" }}
            cx="53"
            cy="8"
            r="2.4"
          />
          <circle
            className="mori-dot"
            style={{ animationDelay: "-.6s" }}
            cx="59"
            cy="3.5"
            r="2.8"
          />
        </g>

        <g className="mori-body">
          {/* A round, squat sprout with a curled stem and a small leaf. */}
          <path className="mori-stem" d="M32 15 C31 10 33 6 37 4" />
          <path
            className="mori-tip"
            d="M37 4 C39 0.5 44 0.5 46 3 C43.5 6.5 39.5 6.5 37 4z"
          />
          <path
            className="mori-shape"
            d="M32 14 C40 11 46 13 51 18 C56 23 58 30 58 37 C58 49 47 58 32 58 C17 58 6 49 6 37 C6 30 8 23 13 18 C18 13 24 11 32 14z"
          />
          <path className="mori-shine" d="M14 34 C14 27 17 22 22 19" />
          <ellipse className="mori-cheek" cx="17.5" cy="46" rx="4.6" ry="3" />
          <ellipse className="mori-cheek" cx="46.5" cy="46" rx="4.6" ry="3" />

          <g className="mori-face f-sleepy">
            <path className="mori-line" d="M21 41.5q4 3.5 8 0" />
            <path className="mori-line" d="M35 41.5q4 3.5 8 0" />
            <path className="mori-line" d="M29 49.5q3 1.6 6 0" />
          </g>
          <g className="mori-face f-calm">
            <circle className="mori-ink" cx="25.5" cy="41" r="2.5" />
            <circle className="mori-ink" cx="38.5" cy="41" r="2.5" />
            <path className="mori-line" d="M28 48q4 3.2 8 0" />
          </g>
          <g className="mori-face f-happy">
            <circle className="mori-ink" cx="25.5" cy="40.5" r="3" />
            <circle className="mori-ink" cx="38.5" cy="40.5" r="3" />
            <circle className="mori-glint" cx="26.4" cy="39.5" r="1" />
            <circle className="mori-glint" cx="39.4" cy="39.5" r="1" />
            <path className="mori-line" d="M26 47q6 6.5 12 0" />
          </g>
          <g className="mori-face f-thriving">
            <path className="mori-line" d="M21.5 42q4 -5.5 8 0" />
            <path className="mori-line" d="M34.5 42q4 -5.5 8 0" />
            <path className="mori-ink" d="M25.5 47q6.5 9 13 0z" />
          </g>
          <g className="mori-face f-listening">
            <circle className="mori-ink" cx="25.5" cy="40.5" r="3.6" />
            <circle className="mori-ink" cx="38.5" cy="40.5" r="3.6" />
            <circle className="mori-glint" cx="26.6" cy="39.2" r="1.2" />
            <circle className="mori-glint" cx="39.6" cy="39.2" r="1.2" />
            <ellipse className="mori-ink" cx="32" cy="50" rx="2.6" ry="3.2" />
          </g>
          <g className="mori-face f-thinking">
            <circle className="mori-ink" cx="26.5" cy="39.5" r="3" />
            <circle className="mori-ink" cx="39.5" cy="39.5" r="3" />
            <circle className="mori-glint" cx="27.7" cy="38.2" r="1.1" />
            <circle className="mori-glint" cx="40.7" cy="38.2" r="1.1" />
            <path className="mori-line" d="M29 49.5h6" />
          </g>
          <g className="mori-face f-celebrating">
            <path className="mori-line" d="M21.5 42q4 -5.5 8 0" />
            <path className="mori-line" d="M34.5 42q4 -5.5 8 0" />
            <path className="mori-ink" d="M23 46.5q9 13 18 0z" />
          </g>
        </g>
      </svg>
    );
  },
);
Mori.displayName = "Mori";

export { Mori };
