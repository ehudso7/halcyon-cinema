import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/styles/globals.css';

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </SessionProvider>
  );
}
