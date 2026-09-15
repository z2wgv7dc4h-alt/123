/**
 * Style descriptors may include artist names (e.g. "Pendulum-vibe").
 * Wyatt policy 2026-09-14: do not strip artist tokens from prompts.
 * Still no catalog rips / stem RE / clone product features elsewhere.
 */
export function scrubArtistNames(text: string): { clean: string; blocked: string[] } {
  return { clean: text, blocked: [] };
}
