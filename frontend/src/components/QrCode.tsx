import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * A scannable QR code for a guest pass token.
 *
 * The previous placeholder derived a checkerboard from the pass id's character
 * codes. It looked like a QR code but encoded nothing, so a guard scanning it
 * at the gate got nothing back — the pass had to be read out and typed in.
 */
export default function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      // A gate scanner reads dark-on-light far more reliably than the app's
      // dark theme colours would allow.
      color: { dark: "#0b1220", light: "#ffffff" },
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not render the pass code.");
    });
  }, [value, size]);

  if (error) {
    return <p className="text-xs font-mono text-red-400">{error}</p>;
  }

  return <canvas ref={canvasRef} className="rounded-sm bg-white" aria-label="Guest pass QR code" />;
}
