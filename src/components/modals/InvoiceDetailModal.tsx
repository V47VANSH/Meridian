import { useState } from "react";
import { Invoice, invoices, residents, notifyMockDataChanged } from "../../api/mockData";
import StatusBadge from "../StatusBadge";

interface InvoiceDetailModalProps {
  invoiceId: string;
  onClose: () => void;
}

export default function InvoiceDetailModal({ invoiceId, onClose }: InvoiceDetailModalProps) {
  const [invoice, setInvoice] = useState<Invoice | undefined>(
    invoices.find((i) => i.id === invoiceId)
  );
  const [reminderSent, setReminderSent] = useState(false);

  if (!invoice) return null;

  const resident = residents.find((r) => r.flatNo === invoice.flatNo);

  const handleRecordPayment = () => {
    const target = invoices.find((i) => i.id === invoice.id);
    if (target) {
      target.status = "PAID";
      setInvoice({ ...target });
      notifyMockDataChanged();
    }
  };

  const handleSendReminder = () => {
    setReminderSent(true);
    setTimeout(() => {
      setReminderSent(false);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs"></div>

      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10">
        {/* Drafting corner ticks */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500"></div>

        {/* Header */}
        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">{invoice.id} / BILL DETAILS</p>
            <h3 className="font-display font-semibold text-base text-ink-100 mt-1">Maintenance Account</h3>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1">
            [×] Close
          </button>
        </div>

        {/* Invoice Info */}
        <div className="border border-blueprint-700 p-3.5 rounded-xs bg-blueprint-950/40 font-mono text-xs mb-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-ink-500 font-mono">Invoice Period:</span>
            <span className="text-ink-100 font-semibold">{invoice.month}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500 font-mono">Due Date:</span>
            <span className="text-ink-100 font-semibold">{invoice.dueDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-500 font-mono">Status:</span>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="flex justify-between pt-1 border-t border-blueprint-800">
            <span className="text-ink-500 font-mono font-semibold">Total Amount:</span>
            <span className="text-signal font-bold text-[14px]">₹{invoice.amount}</span>
          </div>
        </div>

        {/* Resident profile lookup details */}
        <div className="mb-5 border border-blueprint-700/60 p-3.5 rounded-xs bg-blueprint-950/20 text-xs font-body">
          <p className="font-mono text-[9px] uppercase tracking-wider text-ink-500 mb-2.5 font-bold">Resident Billing Details</p>
          {resident ? (
            <div className="space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-ink-500">Name:</span>
                <span className="text-ink-100">{resident.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Flat:</span>
                <span className="text-ink-100">{resident.flatNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Contact Mob:</span>
                <span className="text-ink-100">{resident.contact}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Occupancy Type:</span>
                <span className="text-ink-100">{resident.type}</span>
              </div>
            </div>
          ) : (
            <p className="text-ink-500 font-mono italic">No resident profile linked to flat {invoice.flatNo || "N/A"}.</p>
          )}
        </div>

        {/* Action Controls */}
        <div className="border-t border-blueprint-700 pt-4 bg-blueprint-950/40 -mx-6 -mb-6 p-6 rounded-b-sm flex justify-between gap-3">
          <button
            onClick={handleSendReminder}
            className={`flex-1 py-2 px-3 rounded-sm border text-xs font-semibold tracking-wider font-mono transition ${
              reminderSent
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 cursor-default"
                : "border-blueprint-600 bg-transparent text-ink-100 hover:border-signal hover:text-signal"
            }`}
          >
            {reminderSent ? "✓ REMINDER DISPATCHED" : "SEND REMINDER"}
          </button>
          {invoice.status !== "PAID" && (
            <button
              onClick={handleRecordPayment}
              className="flex-1 btn-primary py-2 text-xs"
            >
              RECORD PAYMENT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
