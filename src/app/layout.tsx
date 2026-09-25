import type { Metadata } from "next";
import { Alex_Brush, Inter, Poppins } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "./providers";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const alexBrush = Alex_Brush({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-alex-brush",
});

export const metadata: Metadata = {
  title: "Centurie Growth",
  description: "Instagram growth, managed.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} ${alexBrush.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
