import './globals.css';
import ThemeProvider from './components/ThemeProvider';
import ThemeToggle from './components/ThemeToggle';
import WalletProvider from './providers/WalletProvider';
import ConnectWallet from './components/ConnectWallet';

export const metadata = {
  title: 'cohortx402',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Preload font files (place fonts in public/fonts/) */}
        <link rel="preload" href="/fonts/MAZIUSREVIEW20.09-Regular.woff" as="font" type="font/woff" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/EBGaramond-VariableFont_wght.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        {/* Ubuntu Mono may not be present locally; load from Google Fonts for a reliable fallback */}
        <link href="https://fonts.googleapis.com/css2?family=Ubuntu+Mono&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>
          <WalletProvider>
            <header className="site-header surface">
              <div className="container">
                <a href="/" className="logo">cohortx402</a>
                <div className="controls-pill">
                  <ThemeToggle />
                  <ConnectWallet />
                </div>
              </div>
            </header>
            <main className="p-6 md:p-10">{children}</main>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
