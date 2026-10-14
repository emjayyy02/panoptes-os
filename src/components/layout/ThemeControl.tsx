import { useTheme } from '../../hooks/useTheme'
import styles from './ThemeControl.module.css'

export function ThemeControl() {
  const { preference, choose } = useTheme()
  return <fieldset className={styles.control}>
    <legend>Theme</legend>
    <div className={styles.options}>{(['system', 'light', 'dark'] as const).map(value => <label key={value}>
      <input type="radio" name="theme" value={value} checked={preference === value} onChange={() => choose(value)} />
      <span>{value[0].toUpperCase() + value.slice(1)}</span>
    </label>)}</div>
  </fieldset>
}
