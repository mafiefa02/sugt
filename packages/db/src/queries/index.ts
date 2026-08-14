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
 * 4. **A Staff-only surface opens with the Staff-only choke point**
 *    (`./staff-only.ts`), which throws a distinguishable typed error. The app
 *    translates it into a 403 — server-side, at the call site. This convention read
 *    *"Money opens with…"* until Jadwalkan Sesi daring, which is Staff-only and is not
 *    money: reading money is Staff-only by ADR-0004, and **arranging delivery** is
 *    Staff-only by the surface list. One guard, two reasons — see `./staff-only.ts`.
 * 5. **A write function owns its own transaction.** Several writes are
 *    multi-statement: Rencanakan Perjadin writes `perjadin`, `group_member` and N
 *    `session` rows; Tandai terlaksana writes `session.status` and `session_teacher`;
 *    a Group is replaced wholesale. The boundary belongs in the function here, never
 *    in the Server Action calling it — a Server Action that opens one has put the
 *    boundary somewhere a second caller cannot reuse. **`arrangeOnlineSession` in
 *    `./arrange-online-session.ts`** exercises it: a Session and its `session_teacher`
 *    rows commit together, and a collision returns a value without writing either. (It
 *    replaced a batch write, `#70`, once online Sessions were arranged one at a time —
 *    a one-row batch was dead weight every reader had to understand.)
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
export {
  delivery,
  publishedStories,
  publishedStory,
  scope,
  type ClusterDelivery,
  type DeliveryData,
  type ScopeCluster,
  type ScopeData,
  type ScopeSchool,
  type StoryDetailData,
  type StoryGalleryPhoto,
  type StoryListItem,
} from "./aggregates";
export {
  addStoryPhotos,
  ceritaIndex,
  createStory,
  deleteStoryPhoto,
  publishStory,
  setStoryCover,
  storyForEditor,
  storyPublicTargets,
  updateStory,
  withdrawStory,
  type CeritaEntry,
  type CreateStoryInput,
  type NewStoryPhoto,
  type PublishResult,
  type StoryForEditor,
  type StoryPhoto,
  type StoryPublicTargets,
  type UpdateStoryInput,
} from "./cerita";
export { concerns, type Concern, type ConcernAspect, type ConcernSource } from "./concerns";
export {
  staffDashboard,
  teachingTeamDashboard,
  type ClusterReach,
  type OwedClassRecord,
  type OwedSessionRecord,
  type PicReport,
  type StaffDashboard,
  type TeachingTeamDashboard,
  type UpcomingSession,
} from "./dashboard";
export { coverage, type CoverageCluster, type CoverageSchool } from "./coverage";
export {
  arrangeOnlineSession,
  arrangeOnlineSessionAt,
  arrangeOnlineSessionForm,
  type ArrangeOnlineSessionAt,
  type ArrangeOnlineSessionForm,
  type ArrangeOnlineSessionInput,
  type ArrangeOnlineSessionResult,
  type ArrangePerson,
  type OnlineSessionTeacher,
  type SchoolOption,
} from "./arrange-online-session";
export {
  movePerjadinDates,
  perjadinDetail,
  replacePerjadinGroup,
  type GroupMemberEntry,
  type MovePerjadinDatesResult,
  type PerjadinDetail,
  type PerjadinSession,
  type ReplaceGroupResult,
} from "./perjadin-detail";
export { perjadinDirectory, type DirectoryPerjadin } from "./perjadin-directory";
export {
  addPerson,
  revokePerson,
  roster,
  type AddPersonResult,
  type NewPerson,
  type RevokePersonResult,
  type RosterEntry,
} from "./roster";
export {
  filePerjadinEvaluation,
  type FilePerjadinEvaluationResult,
  type NewPerjadinEvaluation,
  type PerjadinEvaluationRatings,
} from "./perjadin-evaluation";
export {
  issueFeedbackToken,
  submitParticipantFeedback,
  type IssueFeedbackTokenResult,
  type NewParticipantFeedback,
  type ParticipantFeedbackRatings,
  type SubmitParticipantFeedbackResult,
} from "./participant-feedback";
export {
  perjadinPlan,
  planPerjadin,
  type PerjadinPlan,
  type PlannablePerson,
  type PlannableSchool,
  type PlannableSubCluster,
  type PlannedSession,
  type PlannedTeacher,
  type PlanPerjadinInput,
  type PlanPerjadinResult,
  type SessionTimeClash,
} from "./perjadin-planning";
export {
  attachTransactionEvidence,
  filePerjadinReport,
  markReceiptsSettled,
  perjadinAcquittal,
  recordTransaction,
  type AcquittalEvidence,
  type AcquittalReceipt,
  type AcquittalTransaction,
  type AttachEvidenceResult,
  type FilePerjadinReportResult,
  type MarkReceiptsSettledResult,
  type NewEvidence,
  type NewTransaction,
  type PerjadinAcquittal,
  type RecordTransactionResult,
} from "./perjadin-report";
export {
  schoolDetail,
  type SchoolDetail,
  type SchoolSession,
  type SessionAspect,
  type SessionConcern,
} from "./school-detail";
export { schoolDirectory, type DirectorySchool } from "./school-directory";
export {
  cancelSession,
  correctSessionTeachers,
  markSessionDelivered,
  moveSessionDate,
  sessionDetail,
  type CancelSessionResult,
  type CorrectTeachersResult,
  type MarkDeliveredResult,
  type MoveSessionDateResult,
  type OwedRecord,
  type PastArranged,
  type SessionDetail,
  type SessionDetailTeacher,
  type SessionPerjadin,
  type TaughtBy,
} from "./session-detail";
export {
  fileClassRecord,
  fileSessionRecord,
  type ClassRecordRatings,
  type FileClassRecordResult,
  type FileSessionRecordResult,
  type NewClassRecord,
  type NewSessionRecord,
  type NotDelivered,
  type SessionRecordRatings,
} from "./session-records";
export { isNotStaffError, NotStaffError, requireStaff } from "./staff-only";
export {
  createSubCluster,
  deleteSubCluster,
  moveSchool,
  renameSubCluster,
  subClusterBoard,
  type BlockingPerjadin,
  type ClusterWithSubClusters,
  type CreateSubClusterResult,
  type DeleteSubClusterResult,
  type MoveSchoolResult,
  type NewSubCluster,
  type RenameSubClusterResult,
  type SubClusterSchool,
  type SubClusterWithSchools,
} from "./sub-clusters";
