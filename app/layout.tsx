// app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider"
import { AppSessionProvider } from "@/components/session-provider"
import { DialogProvider } from "@/components/ui/dialog-service"
import { ToastProvider } from "@/components/ui/toast-service"
import { AppQueryProvider } from "@/components/query-provider"
import { ApiProxyProvider } from "@/components/api-proxy-provider"
import "./globals.css"

export const metadata = {
  title: "Bal-Nova | Global Command",
  description: "Unified logistics, finance, and operations dashboard."
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased transition-colors duration-300">
        <AppSessionProvider>
          <ApiProxyProvider>
            <AppQueryProvider>
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
            </AppQueryProvider>
          </ApiProxyProvider>
        </AppSessionProvider>
      </body>
    </html>
  )
}
