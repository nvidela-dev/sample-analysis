import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sample Analyzer | Detect Key & BPM",
  description: "Drop an audio sample to instantly detect its musical key and BPM. Features interactive radar charts, metronome sync, and tone playback. Built for producers and musicians.",
  keywords: ["sample analyzer", "key detection", "BPM detection", "music production", "audio analysis", "tempo finder", "key finder", "DJ tools"],
  authors: [{ name: "nvidela", url: "https://nvidela.dev" }],
  creator: "nvidela",
  metadataBase: new URL("https://sample-analysis.nvidela.dev"),
  openGraph: {
    title: "Sample Analyzer | Detect Key & BPM",
    description: "Drop an audio sample to instantly detect its musical key and BPM. Interactive radar charts, metronome sync, and tone playback.",
    url: "https://sample-analysis.nvidela.dev",
    siteName: "Sample Analyzer",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Sample Analyzer - Detect Key & BPM from audio samples",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sample Analyzer | Detect Key & BPM",
    description: "Drop an audio sample to instantly detect its musical key and BPM. Built for producers and musicians.",
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3D2B1F",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sedgwick+Ave+Display&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
