import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-crema">
      <header className="border-b border-borde bg-papel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
          <Link href="/admin" className="font-semibold tracking-tight">
            Dolfs · panel
          </Link>
          <nav className="flex gap-5 text-sm text-grafito">
            <Link href="/admin" className="hover:text-tinta">
              Comercios
            </Link>
            <Link href="/admin/lista-espera" className="hover:text-tinta">
              Lista de espera
            </Link>
            <Link href="/" className="hover:text-tinta">
              Landing
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
