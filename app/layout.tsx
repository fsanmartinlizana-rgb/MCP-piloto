import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dolfs — que tu tienda aparezca dentro de ChatGPT y Claude",
  description:
    "Conecta tu catalogo una vez y queda disponible cuando alguien le pregunta a un asistente que comprar. El checkout sigue en tu sitio.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
