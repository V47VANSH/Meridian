import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import { useConfirmPayment, useCreatePaymentOrder, useInvoice } from "../../../api/maintenance";
import { useFlatLabels } from "../../../api/directory";
import { useAuthStore } from "../../../store/authStore";
import { CheckoutError, isGatewayConfigured, openCheckout } from "../../../lib/razorpay";
import { formatCurrency, formatDate, formatPeriod } from "../../../lib/format";

export default function PayNowPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const invoiceQuery = useInvoice(invoiceId);
  const flatLabel = useFlatLabels();
  const createOrder = useCreatePaymentOrder();
  const confirmPayment = useConfirmPayment();

  const [paid, setPaid] = useState(false);
  const [checkoutError, setCheckoutError] = useState<Error | null>(null);

  const invoice = invoiceQuery.data;
  const isBusy = createOrder.isPending || confirmPayment.isPending;

  async function handlePay() {
    if (!invoice) return;
    setCheckoutError(null);

    // Every step here is a real state change. The previous version was a
    // setTimeout that flipped a local flag, so a resident saw "Payment
    // confirmed" while the society's records still showed the invoice unpaid.
    const order = await createOrder.mutateAsync(invoice.id);

    if (!isGatewayConfigured(order.key_id)) {
      setCheckoutError(
        new CheckoutError(
          "No payment gateway is configured for this society, so online payment cannot be completed. " +
            "The society office can record your payment against this invoice directly.",
        ),
      );
      return;
    }

    try {
      const result = await openCheckout({
        keyId: order.key_id,
        orderId: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: "Meridian",
        description: `Maintenance for ${formatPeriod(invoice.period)}`,
        prefill: { name: user?.name, email: user?.email },
      });

      // The invoice is settled by this call, not by the widget closing.
      await confirmPayment.mutateAsync({ invoiceId: invoice.id, ...result });
      setPaid(true);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error : new Error("Payment failed."));
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader code="M-01 / PAY NOW" title="Pay Maintenance Invoice" />

      <QueryState
        isLoading={invoiceQuery.isPending}
        error={invoiceQuery.error}
        onRetry={() => invoiceQuery.refetch()}
        loadingLabel="Loading invoice…"
      >
        {invoice && (
          <div className="bp-card p-6">
            {paid || invoice.status === "PAID" ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-xl">
                  ✓
                </div>
                <p className="font-display text-lg mb-1">Payment confirmed</p>
                <p className="text-sm text-ink-300 mb-6">
                  {formatCurrency(invoice.amount)} for {formatPeriod(invoice.period)} has been
                  recorded against invoice {invoice.id}.
                </p>
                <button
                  className="btn-primary"
                  onClick={() => navigate("/resident/maintenance/invoices")}
                >
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
                  <span className="text-ink-500">Flat</span>
                  <span>{flatLabel(invoice.flat_id)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-ink-500">Period</span>
                  <span>{formatPeriod(invoice.period)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-ink-500">Due Date</span>
                  <span>{formatDate(invoice.due_date)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-6">
                  <span className="text-ink-500">Status</span>
                  <StatusBadge status={invoice.status} />
                </div>

                <div className="bp-dimline" />

                <div className="flex items-center justify-between mb-6">
                  <span className="text-ink-300 text-sm">Amount payable</span>
                  <span className="font-display text-2xl font-semibold">
                    {formatCurrency(invoice.amount)}
                  </span>
                </div>

                <div className="space-y-3">
                  <ErrorBanner error={checkoutError ?? createOrder.error ?? confirmPayment.error} />
                  <button className="btn-primary w-full" onClick={handlePay} disabled={isBusy}>
                    {confirmPayment.isPending
                      ? "Confirming…"
                      : createOrder.isPending
                        ? "Opening checkout…"
                        : "Pay with Razorpay"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </QueryState>
    </div>
  );
}
