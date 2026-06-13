import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const poppins = Poppins({ 
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Rise Print India - Enterprise B2B Printing Marketplace",
  description: "Your trusted partner for quality printing solutions across Uttar Pradesh. Visiting cards, flex banners, brochures, and more.",
  keywords: ["printing", "B2B", "Uttar Pradesh", "visiting cards", "flex banner", "brochure printing"],
  authors: [{ name: "Rise Print India" }],
  openGraph: {
    title: "Rise Print India - Enterprise B2B Printing Marketplace",
    description: "Quality printing solutions across Uttar Pradesh",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased`}>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  );
}
