"use client";

import { address, type Address } from "@solana/kit";
import { toast } from "sonner";

export function parseAddress(
  value: string,
  invalidMessage: string
): Address | null {
  try {
    return address(value);
  } catch {
    toast.error(invalidMessage);
    return null;
  }
}
