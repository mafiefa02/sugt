/**
 * What a dead feedback link shows — expired, replaced, unknown or a cancelled Session, all the
 * same. One component so a fresh load and a link that dies while the form is open read the exact
 * same message; #33 asks that expired and replaced be indistinguishable, and the two code paths
 * that reach here must not drift apart.
 *
 * No `"use client"`: it holds no state, so it renders in the server page and inside the client
 * form alike.
 */
function GoneNotice() {
  return (
    <div className="text-center">
      <h1 className="font-heading text-lg font-medium">Tautan sudah tidak berlaku</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tautan umpan balik ini sudah kedaluwarsa atau digantikan. Minta QR yang baru kepada pengajar
        di ruangan.
      </p>
    </div>
  );
}

export { GoneNotice };
