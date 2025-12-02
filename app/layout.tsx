import './globals.css';
import ThemeProvider from './components/ThemeProvider';
import ThemeToggle from './components/ThemeToggle';

export const metadata = {
  title: 'cohortx402',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <header className="w-full flex items-center justify-between p-4 border-b border-muted surface">
            <div className="font-semibold">cohortx402</div>
            <div>
              <ThemeToggle />
            </div>
          </header>
          <main className="p-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
