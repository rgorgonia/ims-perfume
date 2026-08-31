"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

/** Counts up from 0 to `value` with peso formatting. */
export default function Ticker({
  value,
  currencySymbol = "₱",
  currencyLocale = "en-PH",
  className,
}: {
  value: number;
  currencySymbol?: string;
  currencyLocale?: string;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const text = useTransform(
    mv,
    (v) =>
      `${currencySymbol}${v.toLocaleString(currencyLocale, { maximumFractionDigits: 2 })}`
  );

  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.4, ease: "easeOut" });
    return () => controls.stop();
  }, [mv, value]);

  return <motion.span className={className}>{text}</motion.span>;
}
