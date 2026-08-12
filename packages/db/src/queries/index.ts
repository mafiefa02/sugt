/**
 * The query layer. **One module per surface's payload**, and five conventions that
 * every module after this one follows. They were settled on
 * [#12](https://github.com/mafiefa02/sugt/issues/12) and established rather than
 * described by [#25](https://github.com/mafiefa02/sugt/issues/25).
 *
 * 1. **Every exported query function takes a caller**, and takes it first. There is
 *    no way to read or write anything here without saying who is asking.
 * 2. **The caller is three named types, not one with optional fields**
 *    (`./caller.ts`). A query narrows by naming the arm in its signature. Inspecting
 *    a handed value would be a runtime shape check, which is what the three types
 *    exist to avoid.
 * 3. **One function per screen, returning what that screen renders in one round
 *    trip.** SQL shared between two modules goes in an unexported helper beneath
 *    them; nothing is exported that a surface does not render.
 * 4. **Money opens with the Staff-only choke point** (`./staff-only.ts`), which
 *    throws a distinguishable typed error. The app translates it into a 403 —
 *    server-side, at the call site.
 * 5. **A write function owns its own transaction.** Several writes are
 *    multi-statement: Rencanakan Perjadin writes `perjadin`, `group_member` and N
 *    `session` rows; Tandai terlaksana writes `session.status` and `session_teacher`;
 *    a Group is replaced wholesale. The boundary belongs in the function here, never
 *    in the Server Action calling it — a Server Action that opens one has put the
 *    boundary somewhere a second caller cannot reuse. **Nothing in this package
 *    writes yet**, so this convention is stated and not yet exercised; the first
 *    write ticket is what proves it.
 *
 * Validation belongs beside the write, in this package, for the rules
 * `docs/data-model.md` describes as *enforced twice by design* — chief among them
 * prose being required on a Rating of 7 or below. Keeping validation and the choke
 * point in one package is worth more than keeping a rule beside the constants it
 * reads, so those live here rather than in `@sugt/domain`. The forms import them
 * from here, which they may: `@sugt/internal` already declares `@sugt/db`.
 *
 * **This package resolves nobody.** `@sugt/internal` produces the `Person` these
 * take; see `./caller.ts`.
 */
export type { Caller, ParticipantToken, Person, ServiceCaller } from "./caller";
export { coverage, type CoverageCluster, type CoverageSchool } from "./coverage";
export { perjadinAcquittal, type PerjadinAcquittal } from "./perjadin-report";
export { isNotStaffError, NotStaffError, requireStaff, type StaffPerson } from "./staff-only";
