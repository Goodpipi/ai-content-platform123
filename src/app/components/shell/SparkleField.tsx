const SPARKLES = [
  { top: '8%', left: '12%', size: 10, delay: '0s', color: '#54B9F9' },
  { top: '18%', left: '82%', size: 14, delay: '1.2s', color: '#8AD329' },
  { top: '62%', left: '6%', size: 8, delay: '0.6s', color: '#8AD329' },
  { top: '72%', left: '88%', size: 12, delay: '2s', color: '#54B9F9' },
  { top: '35%', left: '92%', size: 9, delay: '1.6s', color: '#8AD329' },
  { top: '48%', left: '4%', size: 11, delay: '2.4s', color: '#54B9F9' },
  { top: '85%', left: '40%', size: 7, delay: '0.9s', color: '#8AD329' },
  { top: '14%', left: '48%', size: 9, delay: '2.8s', color: '#54B9F9' },
];

const DOTS = [
  { top: '26%', left: '30%', d: '0.4s' },
  { top: '54%', left: '70%', d: '1.4s' },
  { top: '80%', left: '20%', d: '2.2s' },
  { top: '22%', left: '68%', d: '3s' },
  { top: '70%', left: '55%', d: '0.2s' },
];

export function SparkleField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {SPARKLES.map((s, i) => (
        <svg
          key={i}
          className="absolute animate-twinkle drop-shadow-[0_0_6px_currentColor]"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            color: s.color,
            animationDelay: s.delay,
          }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0 L13.8 9.2 L24 11 L13.8 12.8 L12 22 L10.2 12.8 L0 11 L10.2 9.2 Z" />
        </svg>
      ))}
      {DOTS.map((p, i) => (
        <span
          key={`d-${i}`}
          className="absolute h-1 w-1 rounded-full bg-white animate-twinkle-soft shadow-[0_0_8px_rgba(255,255,255,0.9)]"
          style={{ top: p.top, left: p.left, animationDelay: p.d }}
        />
      ))}
    </div>
  );
}
