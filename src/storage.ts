import { hasSupabaseConfig, supabase } from './supabase';
import { Invoice } from './types';

const STORAGE_KEY = 'selva-invoices-v1';
const SUPABASE_TABLE = 'selva_invoices';

type InvoiceRecord = {
  id: string;
  payload: Invoice;
  updated_at: string;
};

function cloneInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    entries: invoice.entries.map((e) => ({ ...e })),
  };
}

function loadLocalInvoices(): Invoice[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Invoice[];
    return Array.isArray(parsed) ? parsed.map(cloneInvoice) : [];
  } catch {
    return [];
  }
}

function saveLocalInvoices(invoices: Invoice[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

async function loadRemoteInvoices(): Promise<Invoice[]> {
  if (!supabase) return loadLocalInvoices();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('id,payload,updated_at')
    .order('updated_at', { ascending: false });
  if (error || !data) return loadLocalInvoices();
  return (data as InvoiceRecord[]).map((r) => cloneInvoice(r.payload));
}

async function saveRemoteInvoice(invoice: Invoice): Promise<void> {
  if (!supabase) {
    const invoices = loadLocalInvoices();
    const next = invoices.some((i) => i.id === invoice.id)
      ? invoices.map((i) => (i.id === invoice.id ? cloneInvoice(invoice) : i))
      : [cloneInvoice(invoice), ...invoices];
    saveLocalInvoices(next);
    return;
  }
  const record: InvoiceRecord = {
    id: invoice.id,
    payload: cloneInvoice(invoice),
    updated_at: invoice.updatedAt,
  };
  const { error } = await supabase.from(SUPABASE_TABLE).upsert(record);
  if (error) throw error;
}

async function deleteRemoteInvoice(invoiceId: string): Promise<void> {
  if (!supabase) {
    saveLocalInvoices(loadLocalInvoices().filter((i) => i.id !== invoiceId));
    return;
  }
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', invoiceId);
  if (error) throw error;
}

export async function loadInvoices(): Promise<Invoice[]> {
  return hasSupabaseConfig ? loadRemoteInvoices() : loadLocalInvoices();
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  await saveRemoteInvoice(invoice);
}

export async function removeInvoice(invoiceId: string): Promise<void> {
  await deleteRemoteInvoice(invoiceId);
}

export async function duplicateInvoice(invoice: Invoice, invoiceNumber: string): Promise<Invoice> {
  const now = new Date().toISOString();
  const copy: Invoice = {
    ...cloneInvoice(invoice),
    id: crypto.randomUUID(),
    invoiceNumber,
    createdAt: now,
    updatedAt: now,
  };
  await saveInvoice(copy);
  return copy;
}

export function nextInvoiceNumber(existing: Invoice[]): string {
  const maxSeq = existing.reduce((max, inv) => {
    const match = inv.invoiceNumber.match(/(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  const next = maxSeq + 1;
  const year = new Date().getFullYear();
  return `${year}-${String(next).padStart(4, '0')}`;
}
