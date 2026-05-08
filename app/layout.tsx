import type { Metadata, Viewport } from "next"
import { Inter, IBM_Plex_Mono, Geist } from "next/font/google"
import { TradesProvider } from "./lib/TradesContext"
import { AuthProvider } from "./components/AuthProvider"
import { createClient } from "@/lib/supabase/server"
import "./globals.css"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "TRADING EDGE",
  description: "Prop futures trading journal & AI coaching",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TRADING EDGE",
  },
  icons: {
    apple: [
      { url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060b14",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <html lang="en" className={cn(inter.variable, ibmPlexMono.variable, "font-sans", geist.variable)}>
      <body className="h-dvh overflow-hidden">
        <AuthProvider initialUser={user}>
          <TradesProvider>
            {children}
          </TradesProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
