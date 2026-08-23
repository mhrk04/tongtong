"use client";

import { useCallback, useState } from "react";

export function useCopyToClipboard<T>({
  resetDelay,
  resetValue,
  onError,
}: {
  resetDelay: number;
  resetValue: T;
  onError?: () => void;
}) {
  const [copied, setCopied] = useState(resetValue);

  const copy = useCallback(
    async (text: string, value: T) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(value);
        window.setTimeout(() => setCopied(resetValue), resetDelay);
      } catch {
        onError?.();
      }
    },
    [onError, resetDelay, resetValue]
  );

  return { copied, copy };
}
