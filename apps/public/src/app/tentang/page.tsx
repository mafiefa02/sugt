import { Band } from "-/components/band";
import { Prose } from "-/components/prose";
import type { Metadata } from "next";

/**
 * **Tentang — what the Programme is, and who runs it.**
 *
 * Editorial prose, fetched from nothing: the Programme's account of itself does not change with a
 * trip, so this page reads no aggregates and is fully static. It is the one place the site explains
 * itself rather than showing figures.
 */
export const metadata: Metadata = { title: "Tentang" };

export default function Page() {
  return (
    <Band className="py-16">
      <h1 className="font-heading text-4xl font-bold tracking-tight">Tentang</h1>
      <div className="mt-6">
        <Prose>
          <p>
            <strong>Sekolah Unggul Garuda Transformasi (SUGT)</strong> — STEM &amp; Research Track —
            adalah program pendampingan yang dijalankan oleh Direktorat Persiapan Bersama (DITSAMA)
            Institut Teknologi Bandung bersama Sekolah-Sekolah unggulan di seluruh Indonesia.
          </p>
          <p>
            Program ini bekerja dalam empat Cluster, masing-masing menggarap satu Topik dan menjawab
            satu Masalah nyata. Setiap Sekolah didampingi lintas dua Stream — STEM dan Research —
            melalui rangkaian Sesi, baik luring maupun daring, sepanjang tahun.
          </p>
          <p>
            Situs ini adalah jendela publik program: cakupan Sekolah dan Cluster yang menjadi
            sasaran, capaian penyelenggaraan seiring berjalannya waktu, serta cerita dari lapangan
            dan Final Project yang dihasilkan Project Team.
          </p>
        </Prose>
      </div>
    </Band>
  );
}
