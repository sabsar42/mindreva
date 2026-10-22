/**
 * Lightweight server timing logs for the hot DB/Storage paths. One line per
 * step, always with the same prefix so Vercel runtime logs can be filtered:
 *
 *   [timing] route=entry-detail step=photos ms=41
 *
 * Set TIMING_LOGS=0 to silence them.
 */
export async function timed<T>(
  route: string,
  step: string,
  work: Promise<T> | (() => Promise<T>),
): Promise<T> {
  if (process.env.TIMING_LOGS === "0") {
    return typeof work === "function" ? work() : work;
  }
  const start = performance.now();
  try {
    return await (typeof work === "function" ? work() : work);
  } finally {
    console.log(
      `[timing] route=${route} step=${step} ms=${Math.round(performance.now() - start)}`,
    );
  }
}
