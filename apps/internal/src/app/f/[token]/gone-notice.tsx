/**
 * What a dead feedback link shows — an unknown link or a cancelled Session's, the same. A link no
 * longer expires and is never replaced (ADR-0049), so those are the only two ways here. One
 * component so a fresh load and a link that dies while the form is open read the exact same
 * message; the two code paths that reach here must not drift apart.
 *
 * No `"use client"`: it holds no state, so it renders in the server page and inside the client
 * form alike.
 */
function GoneNotice() {
  return (
    <div className="text-center">
      <h1 className="font-heading text-lg font-medium">Tautan sudah tidak berlaku</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tautan umpan balik ini tidak dikenali, atau sesinya sudah dibatalkan. Periksa kembali
        tautannya, atau tanyakan kepada narasumber di ruangan.
      </p>
    </div>
  );
}

export { GoneNotice };
