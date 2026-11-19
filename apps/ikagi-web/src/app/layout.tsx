import { Navbar } from '../components/layout/navbar';
import { AuthProvider } from '../context/auth.context';
import './global.css';

export const metadata = {
  title: 'Ikagi',
  description: 'Ikagi Web Application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
