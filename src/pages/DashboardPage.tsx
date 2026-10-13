import { useDashboardData } from '../hooks/useDashboardData'
import { SummaryMetrics } from '../components/dashboard/SummaryMetrics'
import { FailureDistribution } from '../components/dashboard/FailureDistribution'
import { RecentIncidentsTable } from '../components/dashboard/RecentIncidentsTable'
import { DataState, RefreshWarning } from '../components/shared/DataState'
import { number, operatorTimeZone, timestamp } from '../utils/formatters'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const { summary, incidents, refresh, refreshing } = useDashboardData()
  const bothLoaded = !!summary.data && !!incidents.data
  const hasError = !!summary.error || !!incidents.error
  const connection = refreshing ? 'Refreshing API data' : hasError ? 'API data incomplete' : bothLoaded ? 'API data loaded' : 'Waiting for API data'
  return <>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>OPERATIONS / OVERVIEW</p><h1>Incident overview</h1><p className={styles.description}>Recovery states, safety signals, and incidents requiring attention.</p></div>
      <button className={styles.refresh} onClick={refresh} disabled={refreshing}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 7A6.5 6.5 0 1 0 16 13M16 3v4h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{refreshing ? 'Refreshing…' : 'Refresh data'}
      </button>
    </div>
    <div className={styles.context}><p role="status" aria-live="polite"><span className={`${styles.dot} ${hasError ? styles.errorDot : bothLoaded && !refreshing ? styles.loadedDot : ''}`} aria-hidden="true" />{connection}</p><span>Manual refresh <span className={styles.separator}>/</span> Times in {operatorTimeZone}</span></div>
    <section className={styles.panel} aria-label="Incident summary" aria-busy={summary.loading}>
      {summary.data ? <>{summary.error && <RefreshWarning error={summary.error} />}<SummaryMetrics summary={summary.data} /><p className={styles.summaryTime}>Summary generated <time dateTime={summary.data.generated_at}>{timestamp(summary.data.generated_at, true)}</time> · Metrics may overlap.</p></>
        : <DataState kind={summary.loading ? 'loading' : 'error'} title={summary.loading ? 'Loading incident summary' : 'Summary unavailable'} message={summary.error ?? 'Requesting current counts from Panoptes.'} />}
    </section>
    <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="recent-title" aria-busy={incidents.loading}>
        <div className={styles.sectionHeading}><div><h2 id="recent-title">Recent incidents</h2><p>{incidents.data ? `Latest ${Math.min(10, incidents.data.incidents.length)} of ${number(incidents.data.incidents.length)} returned incidents` : 'Workflow failures reported to Panoptes'}</p></div><span className={styles.sectionLabel}>OCCURRED ↓</span></div>
        {incidents.data ? <>{incidents.error && <RefreshWarning error={incidents.error} />}<RecentIncidentsTable incidents={incidents.data.incidents} /><p className={styles.freshness}>Fetched <time dateTime={incidents.fetchedAt ?? undefined}>{timestamp(incidents.fetchedAt, true)}</time></p></>
          : <DataState kind={incidents.loading ? 'loading' : 'error'} title={incidents.loading ? 'Loading recent incidents' : 'Incidents unavailable'} message={incidents.error ?? 'Requesting workflow incidents from Panoptes.'} />}
      </section>
      <section className={`${styles.panel} ${styles.distribution}`} aria-labelledby="distribution-title" aria-busy={summary.loading}>
        <div className={styles.sectionHeading}><div><h2 id="distribution-title">Failure distribution</h2><p>Classification from the API summary</p></div></div>
        {summary.data ? <>{summary.error && <RefreshWarning error={summary.error} />}<FailureDistribution failures={summary.data.failure_types} /></>
          : <DataState kind={summary.loading ? 'loading' : 'error'} title={summary.loading ? 'Loading classifications' : 'Distribution unavailable'} message={summary.error ?? undefined} />}
      </section>
    </div>
  </>
}
