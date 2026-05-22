export type DayEntry = {
  date: string;
  hours: number;
  description: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientInfo: string;
  phaseCode: string;
  projectName: string;
  projectNumber: string;
  periodFrom: string;
  periodTo: string;
  hourlyRate: number;
  loaPerDay: number;
  gstRate: number;
  entries: DayEntry[];
  createdAt: string;
  updatedAt: string;
};
