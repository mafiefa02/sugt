import type { DriveRefusal } from "-/lib/drive/upload-messages";
import type { DocumentFields, DocumentFieldsRefusal } from "@sugt/db/queries";

/**
 * The shapes the Dokumen dialog's Server Actions pass to and from the client (ADR-0042). They live
 * here rather than in `actions.ts` because that file is `"use server"`, and a type is not an
 * action.
 */

/** The one PDF the dialog is about to upload: its size and the browser's word for its type. */
export type DocumentToOpen = { size: number; contentType: string };

/** What `openDocumentSessionAction` did: a session URI, or why none. */
export type OpenDocumentSessionResult =
  | { outcome: "ready"; sessionUri: string }
  | { outcome: "no-such-perjadin" }
  /** Not a PDF, by the browser's word. The server sniffs the bytes again once they land. */
  | { outcome: "not-pdf" }
  | { outcome: "too-large"; limit: number }
  | DriveRefusal;

/** What the dialog sends once the PDF has landed in Drive: the sheet's fields and the file's id. */
export type DocumentToRecord = DocumentFields & { perjadinId: string; driveFileId: string };

/**
 * What `recordDocumentAction` did. The fields' refusals, plus the ones only the action can see: a
 * file that is not what it claims (`file-unverified`: not this Perjadin's, not in `_staging`,
 * trashed, over the cap; `not-pdf`: its first bytes are no PDF) and Drive itself being unusable.
 * **Every one of those records nothing.**
 *
 * `recorded` carries `synced`: false when the row is written but the reconcile could not yet put
 * the file in place — never an error, since the document stands.
 */
export type RecordDocumentActionResult =
  | { outcome: "recorded"; documentId: string; synced: boolean }
  | DocumentFieldsRefusal
  | { outcome: "file-unverified" }
  | { outcome: "not-pdf" }
  | DriveRefusal;
