'use client';
import {useState, type ReactNode} from 'react';

/* Filter chips for the Upcoming Events series grid (Figma 6241:116391). "All Events"
   shows every series; other chips match the series tag case-insensitively. */
export function SeriesFilter({filters, items, notice}: {filters: string[]; items: {tag: string; key: string; node: ReactNode}[]; notice: ReactNode}) {
  const [active, setActive] = useState(filters[0]);
  const all = active === filters[0];
  const visible = items.filter(i => all || i.tag.toLowerCase() === active.toLowerCase());
  return (
    <>
      <div className="fx-filters" role="group" aria-label="Filter event series">
        {filters.map(f => (
          <button key={f} type="button" className={'wj-control fx-filter' + (f === active ? ' is-active' : '')} aria-pressed={f === active} onClick={() => setActive(f)}>{f}</button>
        ))}
      </div>
      {notice}
      <div className="fx-grid fx-cols-2 fx-events" aria-live="polite">
        {visible.length ? visible.map(i => <div key={i.key} className="fx-event-cell">{i.node}</div>) : <p className="fx-empty">No {active.toLowerCase()} series are scheduled right now. Ask our team about upcoming dates.</p>}
      </div>
    </>
  );
}
