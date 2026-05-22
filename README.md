# Form Vault

Form Vault is a Vite + React app for creating reusable invoice-style forms, saving them in Supabase, revisiting older drafts, searching saved records, and exporting the active form as a PDF.

## Features

- Create a new form from the editor panel.
- Save forms to Supabase, with a local fallback when no backend is configured.
- Re-open previously saved forms from the sidebar.
- Search saved forms.
- Duplicate or delete saved forms.
- Export the current form to a PDF.
- Edit line items and see totals update live.

## Development

1. Install dependencies with `npm install`.
2. Start the app with `npm run dev`.
3. Build for production with `npm run build`.

## Storage

Saved forms use a Supabase table named `invoice_forms` when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Without those variables, the app falls back to `localStorage` under the key `form-vault-forms-v1`.

## Supabase Schema

Create a table named `invoice_forms` with at least these columns:

- `id` text primary key
- `payload` jsonb not null
- `updated_at` timestamptz not null

Row-level security and policies should allow your app to read and write rows for the current workspace.