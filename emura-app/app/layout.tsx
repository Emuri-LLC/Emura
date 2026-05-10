import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Emura — Manufacturing Cost Estimator',
  description: 'Manufacturing cost estimation for contract manufacturers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="/emura.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
