import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/noto-sans-tc/400.css";
import "@fontsource/noto-sans-tc/500.css";
import "@fontsource/noto-sans-tc/600.css";
import "@fontsource/noto-sans-tc/700.css";
import "./globals.css";
import { PreferencesProvider } from "@/components/preferences";

export const metadata: Metadata = {
  title: "BFT PED｜工程設備箱管理",
  description: "伺服器工廠 PED 工程設備箱、零件清單、產線借用、簽核與點交管理。Engineering kit control for server manufacturing.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('bft.theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.lang=localStorage.getItem('bft.locale')==='en'?'en':'zh-Hant';}catch(e){}})();` }} /></head>
      <body><PreferencesProvider>{children}</PreferencesProvider></body>
    </html>
  );
}
