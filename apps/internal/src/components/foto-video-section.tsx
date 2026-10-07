"use client";

import { FotoVideoDialog } from "-/components/foto-video-dialog";
import { FotoVideoList } from "-/components/foto-video-list";
import type { UploadGate } from "-/lib/drive/upload-gate";
import type { SessionFootageRow } from "@sugt/db/queries";
import { Button } from "@sugt/ui/components/button";
import { useRouter } from "next/navigation";

/**
 * **The Foto & Video section on `/sesi/[id]`** (#425), so a Pimpinan — who cannot open `/pendamping`
 * — sees a Session's photos and videos too. The list, with **Buka** for everyone; for Staff, **Hapus**
 * and the upload popup. A cancelled Session keeps its list but offers no upload.
 */
function FotoVideoSection({
  sessionId,
  heldOn,
  schoolName,
  footage,
  isStaff,
  cancelled,
  uploadGate,
}: {
  sessionId: string;
  heldOn: string;
  schoolName: string;
  footage: SessionFootageRow[];
  isStaff: boolean;
  cancelled: boolean;
  uploadGate: UploadGate;
}) {
  const router = useRouter();
  const refresh = () => {
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3 border-b border-border px-4 py-5 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-medium">Foto & Video</h2>
        {isStaff && !cancelled && (
          <FotoVideoDialog
            sessionId={sessionId}
            heldOn={heldOn}
            schoolName={schoolName}
            uploadGate={uploadGate}
            canUpload
            canDelete
            onChanged={refresh}
            trigger={
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
              >
                Unggah Foto & Video
              </Button>
            }
          />
        )}
      </div>
      <FotoVideoList
        footage={footage}
        hapus={isStaff ? { gate: uploadGate, onDeleted: refresh } : undefined}
      />
    </section>
  );
}

export { FotoVideoSection };
