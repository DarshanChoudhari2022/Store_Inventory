'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep diagnostics in the browser console without exposing credentials or
    // database details in the UI.
    console.error(error);
  }, [error]);

  return (
    <main style={{ maxWidth: 640, margin: '12vh auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ color: '#2d6a4f', fontWeight: 700 }}>StoreStock</p>
      <h1>Something went wrong</h1>
      <p>That screen could not be loaded. Your saved shop data is still protected.</p>
      <button type="button" onClick={() => reset()} style={{ padding: '12px 18px', cursor: 'pointer' }}>
        Try again
      </button>
    </main>
  );
}
