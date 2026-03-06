'use client'

import React from 'react'

interface ProPaywallModalProps {
  onClose: () => void
  /** Which feature triggered the gate */
  feature?: string
}

const PRO_FEATURES = [
  '✨ Generare inteligentă a listei de cumpărături',
  '🛒 Potrivire vânzător alimentar și prețuri',
  '📷 Scanare vizuală a ingredientelor (frigider → rețete)',
  '📅 Planificare de mese pe mai multe săptămâni',
  '🔔 Mai mult în curând',
]

const PRO_PRICE = '29 RON / lună'

export default function ProPaywallModal({ onClose, feature }: ProPaywallModalProps) {
  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: '32px 28px',
          maxWidth: 400, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 16,
            background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: '#aaa', lineHeight: 1,
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Star badge */}
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, marginBottom: 16,
          boxShadow: '0 4px 12px rgba(217,119,6,0.35)',
        }}>
          ⭐
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 6px' }}>
          Funcție Pro
        </h2>

        {feature && (
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px' }}>
            <strong style={{ color: '#111' }}>{feature}</strong> este disponibilă în planul Pro.
          </p>
        )}

        {!feature && (
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px' }}>
            Această funcție este disponibilă în planul Pro.
          </p>
        )}

        {/* Feature list */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRO_FEATURES.map((f) => (
            <li key={f} style={{ fontSize: 14, color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}>
              {f}
            </li>
          ))}
        </ul>

        {/* Price */}
        <div style={{
          background: '#f9f9f9', borderRadius: 12, padding: '12px 16px',
          marginBottom: 20, textAlign: 'center',
        }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#111' }}>{PRO_PRICE}</span>
          <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>Fără angajament. Anulezi oricând.</p>
        </div>

        {/* CTA */}
         <button
           onClick={() => {
             // TODO: replace with real checkout URL (Stripe / netopia.ro)
             alert('Plăți în curând! Revino pentru a te abona.')
             onClose()
           }}
           style={{
             width: '100%', padding: '14px', borderRadius: 12,
             background: 'linear-gradient(135deg, #f59e0b, #d97706)',
             color: '#fff', border: 'none', fontSize: 16, fontWeight: 700,
             cursor: 'pointer', boxShadow: '0 4px 14px rgba(217,119,6,0.4)',
             marginBottom: 10,
           }}
         >
           Treci la Pro →
         </button>

         <button
           onClick={onClose}
           style={{
             width: '100%', padding: '10px', borderRadius: 12,
             background: 'transparent', color: '#999', border: 'none',
             fontSize: 14, cursor: 'pointer',
           }}
         >
           Poate mai târziu
         </button>
      </div>
    </div>
  )
}
