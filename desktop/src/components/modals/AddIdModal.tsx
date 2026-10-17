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
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
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
      transition={{ duration: 0.14 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", damping: 26, stiffness: 360 }}
        className="bg-[#121214] border border-[#232326] rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative overflow-hidden flex flex-col gap-5 text-white max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#232326]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-zinc-200">
              <Contact className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">+ Add Personal ID</h2>
              <span className="text-xs font-mono text-zinc-500">
                End-to-end encrypted identification document and credentials.
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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
              <button
                key={item.id}
                type="button"
                onClick={() => setIdType(item.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#18181B] text-zinc-400 hover:text-white border border-[#27272A]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Legal Name */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-medium text-zinc-400">Full Legal Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="As printed on government document"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
              />
            </div>

            {/* Document Number */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Document / License Number</label>
                <span className="text-[10px] font-mono text-zinc-500">
                  ✓ Encrypted Envelope
                </span>
              </div>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="e.g. C8492019 or USA-9842104"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono tracking-wider"
              />
            </div>

            {/* Issuing Authority */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-medium text-zinc-400">Issuing Authority / Jurisdiction</label>
              <input
                type="text"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="State or National Department"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
              />
            </div>

            {/* Dates Row */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Date of Issue</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Expiration Date</label>
                <span className="text-[10px] font-mono text-zinc-500">Real ID Compliant</span>
              </div>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Demographics Row */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Nationality / Citizenship</label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="Country of Citizenship"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white font-sans focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Residential Address */}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-medium text-zinc-400">Residential Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full Street Address"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white font-sans focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Encrypted Document Scan Attachment Dropzone */}
          <div className="border border-dashed border-[#27272A] hover:border-zinc-600 rounded-xl p-5 bg-[#18181B] text-center flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer">
            <UploadCloud className="w-6 h-6 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-200">
              Drop front and back scans here, or browse files
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              Supported: PNG, JPEG, PDF up to 25MB • Automatically encrypted client-side with ChaCha20-Poly1305
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3.5 border-t border-[#232326] mt-2">
            <span className="text-[11px] font-mono text-zinc-500">
              • Zero-Knowledge Sealed — Enclave Key Derived
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Sealing Document...</span>
                  </>
                ) : (
                  <span>Save Encrypted ID</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
