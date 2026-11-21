import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Training Area",
  description: "Plataforma de treinamento em Excel",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
