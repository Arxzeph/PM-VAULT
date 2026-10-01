import React, { useState } from "react";
import { motion } from "motion/react";
import { SaveEntryInput, PersonalIdData } from "../../types";
import { serializeIdToEntryInput } from "../../services/entryHelpers";
import {
  Contact,
  X,
  UploadCloud,
  RefreshCw,
  Car,
  Globe,
  Shield,
  FileCheck,
} from "lucide-react";

interface AddIdModalProps {
  onSave: (input: SaveEntryInput) => Promise<void>;
  onClose: () => void;
}

export const AddIdModal: React.FC<AddIdModalProps> = ({ onSave, onClose }) => {
  const [idType, setIdType] = useState<"driver_license" | "passport" | "national_id" | "residence_permit">(
    "driver_license"
  );
  const [fullName, setFullName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("State of California, USA");
  const [issueDate, setIssueDate] = useState("2020-05-14");
  const [expiryDate, setExpiryDate] = useState("2030-05-14");
  const [dateOfBirth, setDateOfBirth] = useState("1995-08-12");
  const [nationality, setNationality] = useState("United States");
  const [address, setAddress] = useState("742 Evergreen Terrace, San Francisco, CA");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !documentNumber.trim()) return;

    setSaving(true);
    try {
      const data: PersonalIdData = {
        idType,
        fullName: fullName.trim(),
        documentNumber: documentNumber.trim(),
        issuingAuthority: issuingAuthority.trim(),
        issueDate,
        expiryDate,
        dateOfBirth,
        nationality,
        address,
      };

      const entryInput = serializeIdToEntryInput(data);
      await onSave(entryInput);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0F17]/85 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 26, stiffness: 360 }}
        className="bg-[#161B26] border border-slate-700/70 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative overflow-hidden flex flex-col gap-5 text-white max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242B3D]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Contact className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">+ Add Personal ID</h2>
              <span className="text-xs font-mono text-slate-400">
                End-to-end encrypted identification document and credentials.
              </span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Document Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: "driver_license", label: "Driver License", icon: Car },
            { id: "passport", label: "Passport", icon: Globe },
            { id: "national_id", label: "National ID / SSN", icon: Shield },
            { id: "residence_permit", label: "Residence Permit", icon: FileCheck },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = idType === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIdType(item.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#6366F1] text-white shadow-md shadow-[#6366F1]/20 font-semibold"
                    : "bg-slate-800/50 text-slate-400 hover:text-white border border-[#242B3D]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Legal Name */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-medium text-slate-400">Full Legal Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="As printed on government document"
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] font-sans"
              />
            </div>

            {/* Document Number */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">Document / License Number</label>
                <span className="text-[10px] font-mono text-[#38BDF8]">
                  ✓ Encrypted Envelope
                </span>
              </div>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="e.g. C8492019 or USA-9842104"
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] font-mono tracking-wider"
              />
            </div>

            {/* Issuing Authority */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-medium text-slate-400">Issuing Authority / Jurisdiction</label>
              <input
                type="text"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="State or National Department"
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] font-sans"
              />
            </div>

            {/* Dates Row */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Date of Issue</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#6366F1]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">Expiration Date</label>
                <span className="text-[10px] font-mono text-[#38BDF8]">Real ID Compliant</span>
              </div>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#6366F1]"
              />
            </div>

            {/* Demographics Row */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#6366F1]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Nationality / Citizenship</label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="Country of Citizenship"
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2 text-xs text-white font-sans focus:outline-none focus:border-[#6366F1]"
              />
            </div>

            {/* Residential Address */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-medium text-slate-400">Residential Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full Street Address"
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs text-white font-sans focus:outline-none focus:border-[#6366F1]"
              />
            </div>
          </div>

          {/* Encrypted Document Scan Attachment Dropzone */}
          <motion.div
            whileHover={{ scale: 1.01, borderColor: "rgba(99, 102, 241, 0.6)", backgroundColor: "rgba(99, 102, 241, 0.04)" }}
            whileTap={{ scale: 0.99 }}
            className="border-2 border-dashed border-slate-700/80 rounded-xl p-5 bg-[#0D0F17]/60 text-center flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <UploadCloud className="w-6 h-6 text-indigo-400" />
            <span className="text-xs font-medium text-slate-200">
              Drop front and back scans here, or browse files
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Supported: PNG, JPEG, PDF up to 25MB • Automatically encrypted client-side with AES-256 before storage
            </span>
          </motion.div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#242B3D] mt-2">
            <span className="text-[11px] font-mono text-[#38BDF8]">
              • Zero-Knowledge Sealed — Enclave Key Derived
            </span>

            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </motion.button>
              <motion.button
                type="submit"
                disabled={saving}
                whileHover={!saving ? { scale: 1.02 } : undefined}
                whileTap={!saving ? { scale: 0.98 } : undefined}
                className="px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5254e0] text-white text-xs font-semibold shadow-lg shadow-[#6366F1]/20 transition-all cursor-pointer flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sealing Document...</span>
                  </>
                ) : (
                  <span>Save Encrypted ID</span>
                )}
              </motion.button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
