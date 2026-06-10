import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BUST Content OS",
  description: "Sistema operativo de contenido para BUST.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
