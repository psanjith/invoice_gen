import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { exportInvoiceToPdf } from './pdf';
import {
  duplicateInvoice,
  loadInvoices,
  nextInvoiceNumber,
  removeInvoice,
  saveInvoice,
} from './storage';
import { DayEntry, Invoice } from './types';

function newId() {
  return crypto.randomUUID();
}

function cloneInvoice(invoice: Invoice): Invoice {
  return { ...invoice, entries: invoice.entries.map((e) => ({ ...e })) };
}

function generateEntries(from: string, to: string, existing: DayEntry[]): DayEntry[] {
  if (!from || !to || from > to) return existing;
  const map = new Map(existing.map((e) => [e.date, e]));
  const result: DayEntry[] = [];
  const start = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    result.push(map.get(iso) ?? { date: iso, hours: 0, description: 'Straight' });
  }
  return result;
}

function createBlankInvoice(invoiceNumber = ''): Invoice {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return {
    id: newId(),
    invoiceNumber,
    invoiceDate: today,
    clientInfo: '',
    phaseCode: '',
    projectName: '',
    projectNumber: '',
    periodFrom: today,
    periodTo: today,
    hourlyRate: 0,
    loaPerDay: 0,
    gstRate: 0,
    entries: [{ date: today, hours: 0, description: 'Straight' }],
    createdAt: now,
    updatedAt: now,
  };
}

function fmtDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
}

function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState<Invoice>(() => createBlankInvoice(''));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Loading…');
  const [isLoading, setIsLoading] = useState(true);
  const [mobileView, setMobileView] = useState<'list' | 'form'>('list');

  useEffect(() => {
    let cancelled = false;
    void loadInvoices().then((loaded) => {
      if (cancelled) return;
      setInvoices(loaded);
      if (loaded.length > 0) {
        setActiveId(loaded[0].id);
        setDraft(cloneInvoice(loaded[0]));
        setStatus('Ready.');
      } else {
        setDraft(createBlankInvoice(nextInvoiceNumber(loaded)));
        setStatus('Ready — create your first invoice.');
      }
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const sortedInvoices = useMemo(
    () => [...invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [invoices],
  );

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedInvoices;
    return sortedInvoices.filter((inv) =>
      [inv.invoiceNumber, inv.clientInfo, inv.projectName, inv.projectNumber]
        .join(' ').toLowerCase().includes(q),
    );
  }, [search, sortedInvoices]);

  const totalHours = draft.entries.reduce((s, e) => s + e.hours, 0);
  const subtotal = draft.entries.reduce((s, e) => {
    const loa = e.hours > 0 ? draft.loaPerDay : 0;
    return s + e.hours * draft.hourlyRate + loa;
  }, 0);
  const gst = subtotal * draft.gstRate;
  const total = subtotal + gst;

  function setField<K extends keyof Invoice>(field: K, value: Invoice[K]) {
    setDraft((cur) => ({ ...cur, [field]: value }));
  }

  function onInput(field: keyof Invoice) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setField(field, e.target.value as Invoice[typeof field]);
  }

  function onNumberInput(field: keyof Invoice) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setField(field, Number(e.target.value) as Invoice[typeof field]);
  }

  function updatePeriod(field: 'periodFrom' | 'periodTo', value: string) {
    setDraft((cur) => {
      const from = field === 'periodFrom' ? value : cur.periodFrom;
      const to = field === 'periodTo' ? value : cur.periodTo;
      const entries = generateEntries(from, to, cur.entries);
      return {
        ...cur,
        [field]: value,
        entries,
        ...(field === 'periodTo' ? { invoiceDate: value } : {}),
      };
    });
  }

  function updateEntry(index: number, field: keyof DayEntry, value: string | number) {
    setDraft((cur) => ({
      ...cur,
      entries: cur.entries.map((e, i) => i === index ? { ...e, [field]: value } : e),
    }));
  }

  function loadInvoice(id: string) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    setActiveId(id);
    setDraft(cloneInvoice(inv));
    setStatus(`Loaded ${inv.invoiceNumber}.`);
    setMobileView('form');
  }

  function newInvoice() {
    setDraft(createBlankInvoice(nextInvoiceNumber(invoices)));
    setActiveId('');
    setStatus('New invoice started.');
    setMobileView('form');
  }

  function saveCurrentInvoice() {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    setDraft(next);
    setStatus('Saving…');
    void saveInvoice(next)
      .then(() => {
        setInvoices((cur) => {
          const exists = cur.some((i) => i.id === next.id);
          return exists ? cur.map((i) => (i.id === next.id ? next : i)) : [next, ...cur];
        });
        setActiveId(next.id);
        setStatus('Saved.');
      })
      .catch(() => setStatus('Save failed.'));
  }

  function duplicateSaved(id: string) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    setStatus('Duplicating…');
    void duplicateInvoice(inv, nextInvoiceNumber(invoices))
      .then((copy) => {
        setInvoices((cur) => [copy, ...cur]);
        setActiveId(copy.id);
        setDraft(cloneInvoice(copy));
        setStatus('Duplicated.');
        setMobileView('form');
      })
      .catch(() => setStatus('Duplicate failed.'));
  }

  function deleteSaved(id: string) {
    setStatus('Deleting…');
    void removeInvoice(id)
      .then(() => {
        const next = invoices.filter((i) => i.id !== id);
        setInvoices(next);
        if (activeId === id) {
          if (next[0]) {
            setActiveId(next[0].id);
            setDraft(cloneInvoice(next[0]));
          } else {
            setActiveId('');
            setDraft(createBlankInvoice(nextInvoiceNumber(next)));
          }
        }
        setStatus('Deleted.');
        setMobileView('list');
      })
      .catch(() => setStatus('Delete failed.'));
  }

  function exportPdf() {
    void exportInvoiceToPdf(draft);
    setStatus('PDF export started.');
  }

  const formContent = (
    <form className="editor-card" onSubmit={(e) => e.preventDefault()}>
      <h3 className="section-heading">Invoice details</h3>
      <div className="field-grid">
        <label>
          Invoice number
          <input value={draft.invoiceNumber} onChange={onInput('invoiceNumber')} />
        </label>
        <label>
          Invoice date
          <input type="date" value={draft.invoiceDate} onChange={onInput('invoiceDate')} />
        </label>
        <label className="span-2">
          Client / Recipient (To:)
          <textarea
            value={draft.clientInfo}
            onChange={onInput('clientInfo')}
            rows={3}
            placeholder={'Bird LNG Constructors Limited\n102, 17007-107 Ave\nEdmonton, AB, T5S 1G3'}
          />
        </label>
        <label>
          Project name
          <input value={draft.projectName} onChange={onInput('projectName')} placeholder="Woodfibre LNG Project" />
        </label>
        <label>
          Project #
          <input value={draft.projectNumber} onChange={onInput('projectNumber')} placeholder="71055" />
        </label>
        <label>
          Phase code
          <input value={draft.phaseCode} onChange={onInput('phaseCode')} placeholder="00.00.12.00.0000" />
        </label>
        <label>
          Hourly rate ($)
          <input type="number" min="0" step="0.01" value={draft.hourlyRate} onChange={onNumberInput('hourlyRate')} />
        </label>
        <label>
          LOA / day ($)
          <input type="number" min="0" step="0.01" value={draft.loaPerDay} onChange={onNumberInput('loaPerDay')} />
        </label>
        <label>
          GST rate
          <select value={draft.gstRate} onChange={onNumberInput('gstRate')}>
            <option value={0}>0% (no GST)</option>
            <option value={0.05}>5% (GST)</option>
          </select>
        </label>
      </div>

      <div className="period-header">
        <div>
          <h3>Hours by day</h3>
          <p>Set dates — rows generate automatically.</p>
        </div>
        <div className="period-dates">
          <label>
            From
            <input type="date" value={draft.periodFrom} onChange={(e) => updatePeriod('periodFrom', e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={draft.periodTo} onChange={(e) => updatePeriod('periodTo', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="entries-wrap">
        <table className="entries-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Hrs</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {draft.entries.map((entry, i) => {
              const loa = entry.hours > 0 ? draft.loaPerDay : 0;
              const amt = entry.hours * draft.hourlyRate + loa;
              return (
                <tr key={entry.date} className={entry.hours === 0 ? 'zero-row' : ''}>
                  <td className="date-cell">{fmtDisplayDate(entry.date)}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={entry.hours}
                      onChange={(e) => updateEntry(i, 'hours', Number(e.target.value))}
                    />
                  </td>
                  <td className="amt-cell">{amt > 0 ? fmtCurrency(amt) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="entries-total-row">
              <td>Total</td>
              <td>{totalHours} hrs</td>
              <td className="amt-cell">{fmtCurrency(subtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="totals-block">
        <div className="totals-row">
          <span>Subtotal</span>
          <strong>{fmtCurrency(subtotal)}</strong>
        </div>
        <div className="totals-row">
          <span>GST ({(draft.gstRate * 100).toFixed(0)}%)</span>
          <strong>{fmtCurrency(gst)}</strong>
        </div>
        <div className="totals-row total-row">
          <span>Total</span>
          <strong>{fmtCurrency(total)}</strong>
        </div>
      </div>
    </form>
  );

  return (
    <div className={`shell mobile-${mobileView}`}>

      {/* ── SIDEBAR / LIST VIEW ── */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div>
            <p className="eyebrow">Selva Invoices</p>
            <p className="sidebar-status">{isLoading ? 'Loading…' : status}</p>
          </div>
          <button className="primary-button new-btn" onClick={newInvoice} type="button">
            + New
          </button>
        </div>

        <label className="search-field">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices…" />
        </label>

        <div className="saved-list">
          {filteredInvoices.map((inv) => {
            const invTotal = inv.entries.reduce((s, e) => {
              const loa = e.hours > 0 ? inv.loaPerDay : 0;
              return s + e.hours * inv.hourlyRate + loa;
            }, 0);
            return (
              <div key={inv.id} className={inv.id === activeId ? 'saved-item active' : 'saved-item'}>
                <button className="saved-item-main" onClick={() => loadInvoice(inv.id)} type="button">
                  <div className="saved-item-row">
                    <strong>{inv.invoiceNumber}</strong>
                    <span className="saved-item-amount">{fmtCurrency(invTotal)}</span>
                  </div>
                  <span>{inv.projectName || 'No project'}</span>
                  <small>{inv.clientInfo.split('\n')[0] || 'No client'}</small>
                </button>
                <div className="saved-item-actions">
                  <button type="button" onClick={() => duplicateSaved(inv.id)}>Copy</button>
                  <button type="button" onClick={() => deleteSaved(inv.id)}>Delete</button>
                </div>
              </div>
            );
          })}
          {filteredInvoices.length === 0 && !isLoading && (
            <div className="empty-state">
              <p>No invoices yet.</p>
              <button className="primary-button" onClick={newInvoice} type="button">
                Create your first invoice
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── WORKSPACE / FORM VIEW ── */}
      <main className="workspace">

        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button className="back-btn" onClick={() => setMobileView('list')} type="button">
            ← Invoices
          </button>
          <span className="mobile-invoice-num">{draft.invoiceNumber || 'New invoice'}</span>
        </div>

        {/* Desktop hero */}
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Current invoice</p>
            <h2>{draft.invoiceNumber || 'New invoice'}</h2>
            <p>
              {draft.periodFrom && draft.periodTo
                ? `${fmtDisplayDate(draft.periodFrom)} → ${fmtDisplayDate(draft.periodTo)}`
                : 'Set a billing period to generate daily rows.'}
            </p>
          </div>
          <div className="hero-actions">
            <button className="secondary-button" onClick={saveCurrentInvoice} type="button">Save</button>
            <button className="primary-button" onClick={exportPdf} type="button">Export PDF</button>
          </div>
        </section>

        <section className="content-grid">
          {formContent}

          <aside className="preview-card">
            <p className="eyebrow">Summary</p>
            <h3>{draft.invoiceNumber || '—'}</h3>
            <dl className="preview-details">
              <div><dt>Client</dt><dd>{draft.clientInfo.split('\n')[0] || '—'}</dd></div>
              <div><dt>Project</dt><dd>{draft.projectName || '—'}</dd></div>
              <div><dt>Project #</dt><dd>{draft.projectNumber || '—'}</dd></div>
              <div><dt>Phase code</dt><dd>{draft.phaseCode || '—'}</dd></div>
              <div>
                <dt>Period</dt>
                <dd>{draft.periodFrom && draft.periodTo
                  ? `${fmtDisplayDate(draft.periodFrom)} → ${fmtDisplayDate(draft.periodTo)}`
                  : '—'}</dd>
              </div>
              <div>
                <dt>Days / Hours</dt>
                <dd>{draft.entries.filter((e) => e.hours > 0).length} days · {totalHours} hrs</dd>
              </div>
            </dl>
            <div className="totals-block">
              <div className="totals-row"><span>Subtotal</span><strong>{fmtCurrency(subtotal)}</strong></div>
              <div className="totals-row"><span>GST ({(draft.gstRate * 100).toFixed(0)}%)</span><strong>{fmtCurrency(gst)}</strong></div>
              <div className="totals-row total-row"><span>Total</span><strong>{fmtCurrency(total)}</strong></div>
            </div>
            <button className="primary-button full-width" onClick={exportPdf} type="button">Export PDF</button>
          </aside>
        </section>

        {/* Mobile sticky action bar */}
        <div className="mobile-action-bar">
          <div className="mobile-total">{fmtCurrency(total)}</div>
          <div className="mobile-action-btns">
            <button className="secondary-button" onClick={saveCurrentInvoice} type="button">Save</button>
            <button className="primary-button" onClick={exportPdf} type="button">Export PDF</button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
