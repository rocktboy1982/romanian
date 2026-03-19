import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #0d0d0d 100%)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #ff4d6d, #ff9500)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            MareChef.ro
          </div>
        </div>
        <div
          style={{
            fontSize: '28px',
            color: '#a0a0b0',
            fontWeight: 400,
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          Rețete Culinare din Toată Lumea — Gătește cu Stil
        </div>
        <div
          style={{
            display: 'flex',
            gap: '32px',
            marginTop: '40px',
            fontSize: '18px',
            color: '#666',
          }}
        >
          <span>🍽️ 4000+ Rețete</span>
          <span>🍸 900+ Cocktailuri</span>
          <span>📅 Planuri de Masă</span>
          <span>🛒 Liste de Cumpărături</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
