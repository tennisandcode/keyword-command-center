export const metadata = { title: 'Keyword Command Center' };

export default function RootLayout({ children }) {
  const sheetId = process.env.SHEET_ID;
  const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null;
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#fafaf8', color: '#1a1a1a' }}>
        <header style={{ padding: '14px 28px', borderBottom: '1px solid #e5e5e0', display: 'flex', gap: 24, alignItems: 'center' }}>
          <strong>⌁ Keyword Command Center</strong>
          <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
            <a href="/">Dashboard</a>
            <a href="/products">Products</a>
            {sheetUrl && <a href={sheetUrl} target="_blank" rel="noreferrer">Google Sheet ↗</a>}
          </nav>
        </header>
        <main style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  );
}
