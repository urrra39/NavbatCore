/**
 * Thin wrapper over `clsx` to keep import paths consistent across the app.
 * Use `cn(a, b && c, ...)` anywhere conditional class merging is needed.
 */
import clsx, { type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]): string => clsx(inputs);
