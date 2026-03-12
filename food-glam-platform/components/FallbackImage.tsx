'use client'

import Image, { type ImageProps } from 'next/image'
import { useState, useCallback } from 'react'

interface FallbackImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string
  fallbackEmoji?: string
  fallbackClassName?: string
}

/**
 * Image component that gracefully handles broken URLs.
 * Shows a styled placeholder with an emoji when the image fails to load.
 */
export default function FallbackImage({
  fallbackSrc,
  fallbackEmoji = '🍽️',
  fallbackClassName,
  alt,
  className,
  fill,
  width,
  height,
  style,
  ...props
}: FallbackImageProps) {
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    setHasError(true)
  }, [])

  if (hasError) {
    if (fallbackSrc) {
      return (
        <Image
          {...props}
          src={fallbackSrc}
          alt={alt}
          className={className}
          fill={fill}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          style={style}
        />
      )
    }

    // Placeholder with gradient + emoji
    return (
      <div
        className={fallbackClassName || className || ''}
        style={{
          ...(fill
            ? { position: 'absolute', inset: 0, width: '100%', height: '100%' }
            : { width: width ? `${width}px` : '100%', height: height ? `${height}px` : '100%' }),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          ...style,
        }}
      >
        <span
          style={{ fontSize: fill ? '4rem' : '2rem', opacity: 0.7 }}
          role="img"
          aria-label={alt || 'Imagine indisponibilă'}
        >
          {fallbackEmoji}
        </span>
      </div>
    )
  }

  return (
    <Image
      {...props}
      src={props.src}
      alt={alt}
      className={className}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={style}
      onError={handleError}
    />
  )
}
