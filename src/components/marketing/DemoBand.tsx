import { Band } from "@/components/ui/Band";

/**
 * Band demo autofill: satu video, satu caption, nol paragraf.
 *
 * Ini seksi paling sepi di halaman, dan itu tugasnya. Klaim inti produk —
 * "formulirnya terisi sendiri" — dibuktikan sekali oleh rekaman layar dan
 * tidak perlu satu kalimat pun untuk menerangkannya.
 *
 * Mengembalikan null tanpa URL; sebabnya di lib/marketing-demo.ts.
 *
 * Kombinasi atributnya bukan selera: `muted` WAJIB ada bersama `autoPlay`,
 * karena Safari (dan Chrome sejak 2018) menolak memulai video bersuara
 * sendiri — tanpa itu yang tampil adalah bingkai pertama yang beku, di pita
 * yang seluruh maksudnya adalah gerakan. `playsInline` menahan iOS dari
 * membuka video ke layar penuh. `controls` tetap ada supaya orang bisa
 * menghentikannya, dan `preload="metadata"` menahan unduhan penuh sampai
 * videonya benar-benar diminta.
 */
export function DemoBand({ url }: { url: string | null }) {
  if (!url) return null;

  return (
    <Band tone="navy-deep" align="center">
      <video
        className="mx-auto w-full max-w-4xl"
        src={url}
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
      />
      <p className="mt-6 font-mono text-label uppercase text-navy-100">
        Satu klik, formulir terisi sendiri
      </p>
    </Band>
  );
}
