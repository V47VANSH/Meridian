import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import { invoices, notifyMockDataChanged } from "../../../api/mockData";

export default function PayNowPage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const invoice = invoices.find((i) => i.id === invoiceId) ?? invoices[1];
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");

  function handlePay() {
    setStatus("processing");
    // Mock Razorpay Checkout flow — real integration will mount the
    // Razorpay embed here per the architecture doc, then confirm via webhook.
    setTimeout(() => {
      const target = invoices.find((i) => i.id === invoice.id);
      if (target) {
        target.status = "PAID";
        notifyMockDataChanged();
      }
      setStatus("success");
    }, 1200);
  }

  return (
    <div className="max-w-lg">
      <PageHeader code="M-01 / PAY NOW" title="Pay Maintenance Invoice" />

      <div className="bp-card p-6">
        {status === "success" ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-xl">
              ✓
            </div>
            <p className="font-display text-lg mb-1">Payment confirmed</p>
            <p className="text-sm text-ink-300 mb-6">
              ₹{invoice.amount} for {invoice.month} has been recorded against invoice {invoice.id}.
            </p>
            <button className="btn-primary" onClick={() => navigate("/resident/maintenance/invoices")}>
              Back to Invoices
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ink-500">Invoice</span>
              <span className="font-mono text-ink-300">{invoice.id}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ink-500">Period</span>
              <span>{invoice.month}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-6">
              <span className="text-ink-500">Due Date</span>
              <span>{invoice.dueDate}</span>
            </div>
            <div className="bp-dimline" />
            <div className="flex items-center justify-between mb-6">
              <span className="text-ink-300 text-sm">Amount payable</span>
              <span className="font-display text-2xl font-semibold">₹{invoice.amount}</span>
            </div>
            <button className="btn-primary w-full" onClick={handlePay} disabled={status === "processing"}>
              {status === "processing" ? "Processing…" : "Pay with Razorpay"}
            </button>
            <p className="mt-3 text-xs text-ink-500 text-center">
              Checkout embed placeholder — wires to the real Razorpay flow on integration.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
