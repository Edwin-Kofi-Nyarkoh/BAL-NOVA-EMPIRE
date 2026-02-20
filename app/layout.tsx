// app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider"
import { AppSessionProvider } from "@/components/session-provider"
import { DialogProvider } from "@/components/ui/dialog-service"
import { ToastProvider } from "@/components/ui/toast-service"
import "./globals.css"
import {Inter, JetBrains_Mono} from "next/font/google"

export const metadata = {
  title: "Bal-Nova | Global Command",
  description: "Unified logistics, finance, and operations dashboard."
}

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <body suppressHydrationWarning className="antialiased transition-colors duration-300">
        <AppSessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ToastProvider>
              <DialogProvider>
                {children}
              </DialogProvider>
            </ToastProvider>
          </ThemeProvider>
        </AppSessionProvider>
      </body>
    </html>
  )
}
