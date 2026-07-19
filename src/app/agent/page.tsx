import Link from "next/link";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";

const FEATURES = [
  {
    title: "Chat langsung di WhatsApp Anda.",
    body: "Satu nomor WhatsApp Nerona melayani semua pelanggan Nerona Agent. Hubungkan nomor Anda sekali, lalu mulai chat seperti biasa.",
  },
  {
    title: "Ingat percakapan dan bisnis Anda.",
    body: "Nerona Agent mengingat catatan dan fakta penting tentang bisnis Anda dari percakapan sebelumnya, jadi Anda tidak perlu mengulang.",
  },
];

export default function AgentMarketingPage() {
  return (
    <main>
      <section className="bg-white px-6 pb-24 pt-20 text-center dark:bg-black sm:pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Nerona Agent</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-7xl">
            Asisten AI yang{" "}
            <span className="bg-gradient-to-r from-blue-600 to-sky-400 bg-clip-text text-transparent">
              chat langsung di WhatsApp.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 dark:text-gray-400 sm:text-xl">
            Nerona Agent membantu pemilik usaha kecil mencatat pesanan, mengingat percakapan, dan
            menjawab pelanggan — semua lewat WhatsApp yang sudah Anda pakai setiap hari.
          </p>
          <div className="mx-auto mt-16 max-w-lg">
            <AgentChatMockup />
          </div>
        </div>
      </section>

      <section className="bg-[#f5f5f7] px-6 py-24 dark:bg-gray-950 sm:py-32">
        <div className="mx-auto grid max-w-5xl gap-12 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
                {feature.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white px-6 py-16 text-center dark:bg-black">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sudah pelanggan?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Masuk ke akun Anda
          </Link>
        </p>
      </section>
    </main>
  );
}
