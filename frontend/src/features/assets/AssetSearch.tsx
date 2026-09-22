import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { strings } from "@/lib/strings";

interface AssetSearchProps {
  value: string;
  onChange: (query: string) => void;
  className?: string | undefined;
}

export function AssetSearch({ value, onChange, className = "" }: AssetSearchProps) {
  const [prevValue, setPrevValue] = useState(value);
  const [internalValue, setInternalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setInternalValue(value);
  }

  // Debounce onChange by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(internalValue);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [internalValue, onChange]);

  // "/" keyboard shortcut to focus search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleClear() {
    setInternalValue("");
    onChange("");
    inputRef.current?.focus();
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <label htmlFor="asset-search-input" className="sr-only">
        {strings.assets.searchLabel}
      </label>
      <div className="absolute left-3 text-[var(--color-icon-muted)] pointer-events-none flex items-center">
        <Search className="w-4 h-4" aria-hidden="true" />
      </div>
      <input
        ref={inputRef}
        id="asset-search-input"
        type="search"
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={strings.assets.searchPlaceholder}
        className="w-full pl-9 pr-12 py-[6px] text-[var(--text-sm)] bg-[var(--color-neutral-0)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] shadow-none focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] focus:ring-offset-1 placeholder:text-[var(--color-text-muted)]"
      />
      <div className="absolute right-2.5 flex items-center gap-1.5">
        {internalValue ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label={strings.assets.searchClear}
            className="p-0.5 text-[var(--color-icon-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded-[var(--radius-control)]"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <kbd
          aria-hidden="true"
          className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-[var(--font-mono)] text-[var(--color-text-muted)] bg-[var(--color-neutral-2)] border border-[var(--color-border-subtle)] rounded shadow-sm select-none"
        >
          /
        </kbd>
      </div>
    </div>
  );
}
