import { Avatar, AvatarFallback } from "@/components/atoms/Avatar";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  TooltipRemoveWatcherButton,
} from "@/components/atoms/Tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/atoms/Popover";
import { Eye, XCircle } from "lucide-react";

const MAX_DISPLAY = 5;
const MAX_BEFORE_OVERFLOW = 4;

interface Watcher {
  id: number;
  user: number;
  user_full_name: string;
}

interface WatcherAvatarGroupProps {
  watchers: Watcher[];
  onRemove: (watcher: { id: number; name: string }) => void;
}

// Generates a deterministic color from a string — keeps avatars visually distinct
// const getAvatarColor = (name: string): { bg: string; text: string } => {
//   const palette = [
//     { bg: "bg-indigo-100", text: "text-indigo-600" },
//     { bg: "bg-emerald-100", text: "text-emerald-600" },
//     { bg: "bg-amber-100", text: "text-amber-700" },
//     { bg: "bg-rose-100", text: "text-rose-600" },
//     { bg: "bg-cyan-100", text: "text-cyan-700" },
//     { bg: "bg-violet-100", text: "text-violet-600" },
//     { bg: "bg-fuchsia-100", text: "text-fuchsia-600" },
//     { bg: "bg-sky-100", text: "text-sky-700" },
//   ];
//   let hash = 0;
//   for (let i = 0; i < name.length; i++) {
//     hash = name.charCodeAt(i) + ((hash << 5) - hash);
//   }
//   return palette[Math.abs(hash) % palette.length];
// };

export const WatcherAvatarGroup = ({ watchers, onRemove }: WatcherAvatarGroupProps) => {
  if (!watchers || watchers.length === 0) return null;

  const shouldOverflow = watchers.length > MAX_DISPLAY;
  const visibleWatchers = shouldOverflow
    ? watchers.slice(0, MAX_BEFORE_OVERFLOW)
    : watchers;
  const overflowCount = watchers.length - MAX_BEFORE_OVERFLOW;

  return (
    <div className="flex items-center">
      {/* Visible Avatars — overlapping with negative margin */}
      <div className="flex -space-x-2">
        <TooltipProvider>
          {visibleWatchers.map((watcher, index) => {
            // const color = getAvatarColor(watcher.user_full_name);
            return (
              <Tooltip key={watcher.id}>
                <TooltipTrigger asChild>
                  <Avatar
                    className={`h-9 w-9 border-2 border-white ring-2 ring-slate-100 ring-offset-0 transition-all hover:scale-110 hover:z-20 cursor-default`}
                    style={{ zIndex: visibleWatchers.length - index }}
                  >
                    <AvatarFallback className="bg-indigo-100 font-bold text-xs">
                      {watcher.user_full_name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <TooltipRemoveWatcherButton
                    onClick={() =>
                      onRemove({ id: watcher.id, name: watcher.user_full_name })
                    }
                  />
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-none font-bold text-xs">
                  {watcher.user_full_name}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>

        {/* Overflow Circle with Popover */}
        {shouldOverflow && (
          <Popover>
            <PopoverTrigger>
              <Avatar
                className="h-9 w-9 border-2 border-white ring-2 ring-slate-100 ring-offset-0 transition-all hover:scale-110 hover:z-20 cursor-pointer"
                style={{ zIndex: 0 }}
              >
                <AvatarFallback className="bg-slate-700 text-white font-bold text-xs">
                  +{overflowCount}
                </AvatarFallback>
              </Avatar>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-72 p-0 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-slate-400" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    All Watchers
                  </p>
                  <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-200 rounded-full px-2 py-0.5">
                    {watchers.length}
                  </span>
                </div>
              </div>

              {/* Watcher List */}
              <div className="max-h-64 overflow-y-auto py-1">
                {watchers.map((watcher) => {
                  // const color = getAvatarColor(watcher.user_full_name);
                  return (
                    <div
                      key={watcher.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback
                          className={`bg-indigo-100 font-bold text-[10px]`}
                        >
                          {watcher.user_full_name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-slate-700 truncate flex-1">
                        {watcher.user_full_name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove({ id: watcher.id, name: watcher.user_full_name });
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500"
                        title={`Remove ${watcher.user_full_name}`}
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
