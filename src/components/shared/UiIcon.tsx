export type IconName = 'critical' | 'warning' | 'success' | 'info' | 'neutral'
export function UiIcon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {name === 'warning' ? <><path d="m10 2 8 15H2Z" /><path d="M10 7v4m0 3v.1" /></>
      : <><circle cx="10" cy="10" r="7.5" />{name === 'success' ? <path d="m6 10 3 3 5-6" /> : name === 'critical' ? <path d="m7 7 6 6m0-6-6 6" /> : name === 'info' ? <path d="M10 9v5m0-8v.1" /> : <path d="M7 10h6" />}</>}
  </svg>
}
