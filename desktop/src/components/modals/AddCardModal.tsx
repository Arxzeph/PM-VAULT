import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SaveEntryInput, PaymentCardData } from "../../types";
import {
  detectCardBrand,
  formatCardPan,
  serializeCardToEntryInput,
} from "../../services/entryHelpers";
import {
  CreditCard,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MapPin,
  RefreshCw,
} from "lucide-react";

interface AddCardModalProps {
  onSave: (input: SaveEntryInput) => Promise<void>;
  onClose: () => void;
}

export const AddCardModal: React.FC<AddCardModalProps> = ({ onSave, onClose }) => {
  const [cardTitle, setCardTitle] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("08");
  const [expYear, setExpYear] = useState("28");
  const [cvv, setCvv] = useState("");
  const [pin, setPin] = useState("");
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [brand, setBrand] = useState<"visa" | "mastercard" | "amex" | "discover" | "other">("visa");

  // Billing Address
  const [showBilling, setShowBilling] = useState(false);
  const [street, setStreet] = useState("742 Market Street");
  const [city, setCity] = useState("San Francisco");
  const [state, setState] = useState("CA");
  const [zip, setZip] = useState("94107");
  const [country, setCountry] = useState("United States");

  const [saving, setSaving] = useState(false);

  // Auto-detect brand from card number
  useEffect(() => {
    const detected = detectCardBrand(cardNumber);
    if (detected !== "other") {
      setBrand(detected);
    }
  }, [cardNumber]);

  const handleCardNumberChange = (val: string) => {
    const formatted = formatCardPan(val);
    setCardNumber(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber.trim()) return;

    setSaving(true);
    try {
      const cardData: PaymentCardData = {
        cardholderName: cardholderName.trim() || "CARDHOLDER",
        cardNumber: cardNumber.replace(/\s+/g, ""),
        expMonth,
        expYear,
        cvv: cvv || "•••",
        pin,
        brand,
        billingAddress: showBilling
          ? {
              street,
              city,
              state,
              zip,
              country,
            }
          : undefined,
      };

      const title = cardTitle.trim() || `${brand.toUpperCase()} •••• ${cardNumber.slice(-4) || "0000"}`;
      const entryInput = serializeCardToEntryInput(cardData, title);
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
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">+ Add Payment Card</h2>
              <span className="text-xs font-mono text-zinc-500">
                Client-side encrypted with ChaCha20-Poly1305. Never stored plaintext.
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

        {/* Live Interactive Digital Card Preview */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-52 select-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 rounded-md bg-amber-400/80 border border-amber-300 flex items-center justify-center relative overflow-hidden">
                <div className="w-full h-[1px] bg-amber-600/60 my-auto" />
                <div className="w-[1px] h-full bg-amber-600/60 mx-auto" />
              </div>
              <span className="text-zinc-500 text-xs font-mono">((( )))</span>
            </div>
            <span className="text-sm font-mono font-bold tracking-widest text-zinc-200 uppercase">
              {brand.toUpperCase()}
            </span>
          </div>

          <div className="my-auto">
            <span className="font-mono text-xl font-bold tracking-widest text-white">
              {cardNumber || "••••  ••••  ••••  8821"}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 uppercase">
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-500">CARDHOLDER</span>
              <span className="font-semibold text-zinc-200 truncate max-w-[200px]">
                {cardholderName || "YOUR NAME"}
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[9px] text-zinc-500">EXPIRES</span>
              <span className="font-semibold text-zinc-200">{expMonth}/{expYear}</span>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Card Label */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Card Nickname / Title</label>
              <input
                type="text"
                value={cardTitle}
                onChange={(e) => setCardTitle(e.target.value)}
                placeholder="e.g. Chase Sapphire, Corporate Visa"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
              />
            </div>

            {/* Cardholder Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Cardholder Full Name</label>
              <input
                type="text"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="Full Name as on Card"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans uppercase"
              />
            </div>

            {/* Card Number */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Primary Account Number (PAN)</label>
                <span className="text-[10px] font-mono text-zinc-400">
                  {brand.toUpperCase()} DETECTED
                </span>
              </div>
              <input
                type="text"
                required
                value={cardNumber}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                placeholder="16-digit card number"
                maxLength={19}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono tracking-wider"
              />
            </div>

            {/* Expiration Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Expiration Date (MM / YY)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={2}
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value)}
                  placeholder="MM"
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white text-center font-mono focus:outline-none focus:border-zinc-500"
                />
                <span className="text-zinc-600">/</span>
                <input
                  type="text"
                  maxLength={2}
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  placeholder="YY"
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white text-center font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* CVV */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Security Code (CVV)</label>
                <button
                  type="button"
                  onClick={() => setShowCvv((prev) => !prev)}
                  className="text-[10px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  {showCvv ? "Hide" : "Reveal"}
                </button>
              </div>
              <input
                type={showCvv ? "text" : "password"}
                maxLength={4}
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                placeholder="3 or 4 digits"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* PIN (Optional) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Card PIN (Optional)</label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-zinc-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <input
                type={showPin ? "text" : "password"}
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit PIN"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Brand manual selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">Card Brand</label>
              <div className="flex items-center gap-1.5">
                {(["visa", "mastercard", "amex", "discover"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrand(b)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                      brand === b
                        ? "bg-white text-black shadow-sm"
                        : "bg-[#18181B] border border-[#27272A] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Collapsible Billing Address */}
          <div className="border border-[#27272A] rounded-xl p-3 bg-[#18181B] flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowBilling((prev) => !prev)}
              className="flex items-center justify-between w-full text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                <span>Billing Address</span>
              </div>
              {showBilling ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <AnimatePresence>
              {showBilling && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#27272A] overflow-hidden"
                >
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Street Address"
                    className="col-span-2 bg-[#121214] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                  />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="bg-[#121214] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      className="w-16 bg-[#121214] border border-[#27272A] rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-zinc-500"
                    />
                    <input
                      type="text"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="ZIP"
                      className="flex-1 bg-[#121214] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country"
                    className="col-span-2 bg-[#121214] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3.5 border-t border-[#232326] mt-2">
            <span className="text-[11px] font-mono text-zinc-500">
              • Zero-Knowledge Sealed in Hardware Enclave
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
                    <span>Sealing Card...</span>
                  </>
                ) : (
                  <span>Save Encrypted Card</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
