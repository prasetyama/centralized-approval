import * as React from "react";
import { cn } from "@/lib/utils";

const TooltipContext = React.createContext<{
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
} | null>(null);

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const Tooltip = ({ children }: { children: React.ReactNode }) => {
  const [show, setShow] = React.useState(false);

  return (
    <TooltipContext.Provider value={{ show, setShow }}>
      <div
        className="relative flex items-center"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

const TooltipTrigger = ({ children }: { children: React.ReactNode; asChild?: boolean }) => {
  return <>{children}</>;
};

const TooltipContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const context = React.useContext(TooltipContext);
  if (!context?.show) return null;

  return (
    <div
      className={cn(
        "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 overflow-hidden rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-50 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap shadow-xl",
        className
      )}
    >
      {children}
      {/* Small arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
    </div>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
