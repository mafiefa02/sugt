/**
 * Read an environment variable, or fail with a sentence that names the likely cause.
 *
 * turbo runs with `envMode: strict`: a variable missing from the consuming task's `env` in
 * `turbo.json` is invisible to that task **even when it is set in the shell**, surfacing far from the
 * cause as `undefined`. This app reads `INTERNAL_APP_URL` and `AGGREGATES_SECRET` to fetch the
 * aggregates, and `REVALIDATE_SECRET` to authenticate the revalidation route the internal app calls;
 * all three are declared on `build`, `typecheck` and `dev` for `@sugt/public`. Adding another means
 * editing `turbo.json` as well as `.env`.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Note turbo runs with envMode: strict — a variable ` +
        `missing from the consuming task's \`env\` in turbo.json is invisible here ` +
        `even when it is set in the shell.`,
    );
  }
  return value;
}
