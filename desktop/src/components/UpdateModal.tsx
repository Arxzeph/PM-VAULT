import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { UpdateInfo, openReleaseDownload } from "../services/updater";
import { Sparkles, Download, ExternalLink, X, CheckCircle2, ArrowUpRight } from "lucide-react";

interface UpdateModalProps {
  updateInfo: UpdateInfo | null;
  isOpen: boolean;
  onClose: () => void;
  isChecking?: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  updateInfo,
  isOpen,
  onClose,
  isChecking = false,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", damping: 26, stiffness: 360 }}
          className="relative w-full max-w-md bg-[#121214] border border-[#232326] rounded-2xl shadow-2xl p-6 text-zinc-100 z-10 overflow-hidden"
        >
          {/* Close Icon Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>

          {isChecking ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-zinc-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Checking for Updates...</h3>
                <p className="text-xs text-zinc-500 mt-1">Connecting to official repository</p>
              </div>
            </div>
          ) : updateInfo ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-white">Update Available</h3>
                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full font-bold">
                      v{updateInfo.latestVersion}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Currently running v{updateInfo.currentVersion}
                  </p>
                </div>
              </div>

              {/* Release Title & Notes */}
              <div className="p-3.5 bg-[#18181B] border border-[#27272A] rounded-xl space-y-2 max-h-44 overflow-y-auto">
                <h4 className="text-xs font-semibold text-zinc-200">{updateInfo.releaseName}</h4>
                <div className="text-[11px] text-zinc-400 whitespace-pre-line leading-relaxed font-sans">
                  {updateInfo.releaseNotes}
                </div>
              </div>

              {/* Assets list */}
              {updateInfo.assets.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Direct Downloads
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {updateInfo.assets.slice(0, 3).map((asset) => (
                      <button
                        key={asset.name}
                        onClick={() => openReleaseDownload(asset.downloadUrl)}
                        className="w-full px-3 py-2 bg-[#18181B] hover:bg-zinc-800 border border-[#27272A] rounded-xl flex items-center justify-between text-xs text-zinc-300 hover:text-white transition group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Download className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate font-mono text-[11px]">{asset.name}</span>
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white shrink-0 transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 px-3 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 border border-[#27272A] rounded-xl transition cursor-pointer"
                >
                  Later
                </button>
                <button
                  onClick={() => openReleaseDownload(updateInfo.htmlUrl)}
                  className="flex-[2] py-2 px-4 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Release & Install</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-zinc-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Up to Date</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  You are running the latest version <span className="font-mono text-zinc-300">v2.4.0</span>.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 py-1.5 px-4 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
