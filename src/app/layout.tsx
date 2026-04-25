import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import "./estilos.css"
import { toast } from "sonner"
import { Toaster } from "sonner"
import { ThemeProvider } from "next-themes"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" }) 
export const metadata: Metadata = {
  title: "Integra Médica - Portal de Pacientes",
  description: "Tu salud, nuestra prioridad. Agenda citas, consulta resultados y gestiona tu expediente médico.",
  generator: "v0.app",
  icons: {
    icon: [      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#DC2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}


export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">

        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>

      </body>
    </html>
  )
}

