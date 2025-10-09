import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Navigation } from '@/components/navigation'
import { Footer } from '@/components/Footer'
import PasswordProtection from '@/components/PasswordProtection'
import LoadingWrapper from '@/components/LoadingWrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NPS Insights Tool',
  description: 'Net Promoter Score analysis and insights dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <PasswordProtection>
            <LoadingWrapper>
              <div className="min-h-screen flex flex-col">
                <Navigation />
                <main className="flex-1 bg-background">
                  {children}
                </main>
                <Footer />
              </div>
            </LoadingWrapper>
          </PasswordProtection>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
