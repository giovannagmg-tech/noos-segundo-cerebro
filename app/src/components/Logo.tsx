// Marca "noos" — brand/README.md: wordmark minúsculo, peso 800, os dois "o"
// centrais viram dois anéis sobrepostos (só contorno), com a lente (área de
// sobreposição) preenchida na cor de destaque da marca. Construção exata do
// SVG (viewBox 140x100, anéis cx=52/88 r=30) vem do sistema final aprovado
// (seção 10a do brand/Noos - Design Explorations.dc.html) — não redesenhar.
type LogoProps = {
  size?: number
  className?: string
  iconOnly?: boolean
}

export function Logo({ size = 28, className, iconOnly = false }: LogoProps) {
  const svgHeight = size
  const svgWidth = size * (140 / 100)
  // Glifos minúsculos "n"/"s" não têm ascendente/descendente, então o centro
  // óptico da fonte fica um pouco abaixo do meio do em-box — sem esse ajuste
  // os anéis flutuam alto em relação às letras (ver brand/README.md).
  const topOffset = size * (3 / 84)
  const marginX = size * (14 / 84)

  const rings = (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox="0 0 140 100"
      aria-hidden="true"
      style={{
        display: 'block',
        margin: `0 -${marginX}px`,
        position: 'relative',
        top: iconOnly ? 0 : topOffset,
      }}
    >
      <defs>
        <clipPath id="noos-logo-lens">
          <circle cx="52" cy="50" r="30" />
        </clipPath>
      </defs>
      <circle cx="88" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="8" />
      <g clipPath="url(#noos-logo-lens)">
        <circle cx="88" cy="50" r="30" className="fill-primary" />
      </g>
      <circle cx="52" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="8" />
    </svg>
  )

  if (iconOnly) {
    return (
      <span className={className} style={{ color: 'var(--foreground)' }}>
        {rings}
      </span>
    )
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.02em',
        color: 'var(--foreground)',
        lineHeight: 1,
      }}
    >
      n{rings}s
    </span>
  )
}
