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
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Window with Fluid Spring Physics */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 14 }}
          transition={{ type: "spring", damping: 26, stiffness: 360 }}
          className="relative w-full max-w-md bg-[#161B26] border border-[#242B3D] rounded-2xl shadow-2xl p-6 text-slate-100 z-10 overflow-hidden"
        >
          {/* Close Icon Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>

          {isChecking ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-[#38BDF8]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Checking for Updates...</h3>
                <p className="text-xs text-slate-400 mt-1">Connecting to official repository</p>
              </div>
            </div>
          ) : updateInfo ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner">
                  <Sparkles className="w-5 h-5 text-[#38BDF8]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-white">Update Available</h3>
                    <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full font-bold">
                      v{updateInfo.latestVersion}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Currently running v{updateInfo.currentVersion}
                  </p>
                </div>
              </div>

              {/* Release Title & Notes */}
              <div className="p-3.5 bg-[#0D0F17] border border-[#242B3D] rounded-xl space-y-2 max-h-44 overflow-y-auto">
                <h4 className="text-xs font-semibold text-slate-200">{updateInfo.releaseName}</h4>
                <div className="text-[11px] text-slate-400 whitespace-pre-line leading-relaxed font-sans">
                  {updateInfo.releaseNotes}
                </div>
              </div>

              {/* Assets list */}
              {updateInfo.assets.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Direct Downloads
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {updateInfo.assets.slice(0, 3).map((asset) => (
                      <button
                        key={asset.name}
                        onClick={() => openReleaseDownload(asset.downloadUrl)}
                        className="w-full px-3 py-2 bg-slate-800/40 hover:bg-slate-800/80 border border-[#242B3D] rounded-xl flex items-center justify-between text-xs text-slate-300 hover:text-white transition group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Download className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                          <span className="truncate font-mono text-[11px]">{asset.name}</span>
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#38BDF8] shrink-0 transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 px-3 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-[#242B3D] rounded-xl transition"
                >
                  Later
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => openReleaseDownload(updateInfo.htmlUrl)}
                  className="flex-[2] py-2 px-4 bg-[#6366F1] hover:bg-[#5254e0] text-white text-xs font-semibold rounded-xl shadow-lg shadow-[#6366F1]/20 flex items-center justify-center gap-2 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Release & Install</span>
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[#38BDF8]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Up to Date</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You are running the latest version <span className="font-mono text-slate-300">v2.4.0</span>.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-xl transition"
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
