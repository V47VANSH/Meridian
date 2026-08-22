import { useState } from "react";
import StatusBadge from "../StatusBadge";
import { ErrorBanner, LoadingState } from "../QueryState";
import { useInvoice, useRecordOfflinePayment, useSendReminder } from "../../api/maintenance";
import { useFlatLabels } from "../../api/directory";
import { formatCurrency, formatDate, formatDateTime, formatPeriod } from "../../lib/format";

/** Methods the offline-payment endpoint records. */
const OFFLINE_METHODS = ["CASH", "CHEQUE", "BANK_TRANSFER", "UPI"];

interface InvoiceDetailModalProps {
  invoiceId: string;
  onClose: () => void;
}

export default function InvoiceDetailModal({ invoiceId, onClose }: InvoiceDetailModalProps) {
  const { data: invoice, isPending, error } = useInvoice(invoiceId);
  const flatLabel = useFlatLabels();

  const recordPayment = useRecordOfflinePayment();
  const sendReminder = useSendReminder();

  const [method, setMethod] = useState(OFFLINE_METHODS[0]);
  const [reference, setReference] = useState("");

  const isSettled = invoice?.status === "PAID";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs" />

      <div className="relative w-full max-w-md bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10 max-h-[85vh] overflow-y-auto">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500" />

        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">
              BILL DETAILS
            </p>
            <h3 className="font-display font-semibold text-base text-ink-100 mt-1">
              Maintenance Account
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1"
          >
            [×] Close
          </button>
        </div>

        {isPending && <LoadingState label="Loading invoice…" />}
        {error && <ErrorBanner error={error} />}

        {invoice && (
          <>
            <div className="border border-blueprint-700 p-3.5 rounded-xs bg-blueprint-950/40 font-mono text-xs mb-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-500">Invoice:</span>
                <span className="text-ink-100">{invoice.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Flat:</span>
                <span className="text-ink-100 font-semibold">{flatLabel(invoice.flat_id)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Invoice Period:</span>
                <span className="text-ink-100 font-semibold">{formatPeriod(invoice.period)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Due Date:</span>
                <span className="text-ink-100 font-semibold">{formatDate(invoice.due_date)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-500">Status:</span>
                <StatusBadge status={invoice.status} />
              </div>
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-ink-500">Paid At:</span>
                  <span className="text-ink-100">{formatDateTime(invoice.paid_at)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-blueprint-800">
                <span className="text-ink-500 font-semibold">Total Amount:</span>
                <span className="text-signal font-bold text-[14px]">
                  {formatCurrency(invoice.amount)}
                </span>
              </div>
            </div>

            {isSettled ? (
              <p className="text-xs font-mono text-ink-500 text-center py-2">
                This invoice is settled — no further action.
              </p>
            ) : (
              <div className="space-y-4">
                <ErrorBanner error={recordPayment.error ?? sendReminder.error} />

                <div>
                  <p className="bp-eyebrow mb-2">RECORD AN OFFLINE PAYMENT</p>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="input-field"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      {OFFLINE_METHODS.map((option) => (
                        <option key={option} value={option}>
                          {option.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input-field"
                      placeholder="Receipt / reference no."
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn-primary w-full mt-3 text-xs"
                    disabled={recordPayment.isPending}
                    onClick={() =>
                      recordPayment.mutate({
                        invoiceId: invoice.id,
                        method,
                        reference_note: reference.trim(),
                      })
                    }
                  >
                    {recordPayment.isPending ? "Recording…" : "Mark as Paid"}
                  </button>
                </div>

                <div className="border-t border-blueprint-700 pt-4">
                  <button
                    className="btn-secondary w-full text-xs"
                    disabled={sendReminder.isPending}
                    onClick={() => sendReminder.mutate(invoice.id)}
                  >
                    {sendReminder.isPending ? "Sending…" : "Send Payment Reminder"}
                  </button>
                  {sendReminder.data && (
                    <p className="mt-2 text-xs font-mono text-signal text-center">
                      {sendReminder.data.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
