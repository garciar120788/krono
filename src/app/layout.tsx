import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/lora';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/caveat/600.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Krono', template: '%s · Krono' },
  description: 'Organizador personal: tareas, notas diarias, hábitos y calendario.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#F4EEE2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
