import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import ErrorBoundary from '@/components/ErrorBoundary';
import Footer from '@/components/Footer';
import '@/styles/globals.css';

// Pages that should not show the footer
const noFooterPages = ['/auth/signin', '/auth/signup', '/auth/error'];

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  const showFooter = !noFooterPages.includes(router.pathname);

  return (
    <SessionProvider session={session}>
      <ErrorBoundary>
        <div className="app-layout">
          <Component {...pageProps} />
          {showFooter && <Footer />}
        </div>
      </ErrorBoundary>
    </SessionProvider>
  );
}
