import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  children: React.ReactNode;
  className?: string;
}

interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}

const PopoverContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLDivElement>;
} | null>(null);

const Popover = ({ children, className }: PopoverProps) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      <div ref={containerRef} className={cn("relative inline-flex", className)}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

const PopoverTrigger = ({ children }: PopoverTriggerProps) => {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error("PopoverTrigger must be used within a Popover");

  return (
    <div
      ref={context.triggerRef}
      onClick={() => context.setOpen((prev) => !prev)}
      className="cursor-pointer"
    >
      {children}
    </div>
  );
};

const PopoverContent = ({ children, className, align = "center" }: PopoverContentProps) => {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error("PopoverContent must be used within a Popover");
  if (!context.open) return null;

  const alignmentClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };

  return (
    <div
      className={cn(
        "absolute top-full mt-2 z-50 min-w-[240px] rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-200",
        alignmentClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
};

export { Popover, PopoverTrigger, PopoverContent };
