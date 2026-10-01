import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VaultEntry, SaveEntryInput, SecurityQuestion } from "../types";
import { PasswordGenerator } from "./PasswordGenerator";
import { ServiceIcon } from "./ServiceIcon";
import { copyWithAutoWipe } from "../services/clipboard";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  Trash2,
  X,
  Star,
  Globe,
  User,
  Key,
  FileText,
  Tag,
  ShieldCheck,
  HelpCircle,
  Plus,
} from "lucide-react";

const PRESET_SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What elementary school did you attend?",
  "In what city were you born?",
  "What is your mother's maiden name?",
  "What was the make and model of your first car?",
  "What was your childhood nickname?",
  "What is the name of your favorite book or film?",
  "Custom question...",
];

interface EntryEditorProps {
  entry: VaultEntry | null;
  isCreating: boolean;
  onSave: (input: SaveEntryInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export const EntryEditor: React.FC<EntryEditorProps> = ({
  entry,
  isCreating,
  onSave,
  onDelete,
  onClose,
}) => {
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [copiedAnswerIndex, setCopiedAnswerIndex] = useState<number | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setTitle(entry.title || "");
      setUsername(entry.username || "");
      setPassword(entry.password || "");
      setUrl(entry.url || "");
      setNotes(entry.notes || "");
      setTagsInput(entry.tags ? entry.tags.join(", ") : "");
      setFavorite(entry.favorite || false);
      setSecurityQuestions(entry.security_questions || []);
      setRevealedAnswers({});
    } else if (isCreating) {
      setTitle("");
      setUsername("");
      setPassword("");
      setUrl("");
      setNotes("");
      setTagsInput("");
      setFavorite(false);
      setSecurityQuestions([]);
      setRevealedAnswers({});
    }
  }, [entry, isCreating]);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (title.trim()) {
          saveCurrent();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [title, username, password, url, notes, tagsInput, favorite, entry]);

  // Password strength calculation
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 14) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, label: "Weak", color: "bg-rose-500", text: "text-rose-400" };
    if (score === 2) return { score: 2, label: "Fair", color: "bg-amber-500", text: "text-amber-400" };
    if (score === 3) return { score: 3, label: "Good", color: "bg-[#6366F1]", text: "text-[#818CF8]" };
    return { score: 4, label: "Strong", color: "bg-[#38BDF8]", text: "text-[#38BDF8]" };
  }, [password]);

  const handleCopy = async (text: string, type: "user" | "pass") => {
    if (!text) return;
    await copyWithAutoWipe(text);
    if (type === "user") {
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const handleAddQuestion = () => {
    setSecurityQuestions([
      ...securityQuestions,
      { question: PRESET_SECURITY_QUESTIONS[0], answer: "" },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setSecurityQuestions(securityQuestions.filter((_, i) => i !== index));
    const nextRevealed = { ...revealedAnswers };
    delete nextRevealed[index];
    setRevealedAnswers(nextRevealed);
  };

  const handleUpdateQuestion = (
    index: number,
    field: "question" | "answer",
    val: string
  ) => {
    const updated = [...securityQuestions];
    updated[index] = { ...updated[index], [field]: val };
    setSecurityQuestions(updated);
  };

  const handleCopyAnswer = async (text: string, index: number) => {
    if (!text) return;
    await copyWithAutoWipe(text);
    setCopiedAnswerIndex(index);
    setTimeout(() => setCopiedAnswerIndex(null), 2000);
  };

  const generateFakeAnswer = (index: number) => {
    const words = [
      "Solar", "Falcon", "Orbit", "Velvet", "Echo", "Timber", "Cobalt",
      "Aurora", "Summit", "Zephyr", "Opal", "Canyon", "Shadow", "Cosmos",
      "Pioneer", "Granite", "Meadow", "Breeze", "Cinder", "Glacier"
    ];
    const w1 = words[Math.floor(Math.random() * words.length)];
    const w2 = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(100 + Math.random() * 900);
    const fake = `${w1}-${w2}-${num}`;
    handleUpdateQuestion(index, "answer", fake);
  };

  const saveCurrent = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await onSave({
        id: entry?.id,
        title: title.trim(),
        username: username.trim() || undefined,
        password: password || undefined,
        url: url.trim() || undefined,
        notes: notes.trim() || undefined,
        security_questions: securityQuestions.filter(
          (q) => q.question.trim().length > 0 || q.answer.trim().length > 0
        ),
        tags,
        favorite,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCurrent();
  };

  return (
    <div className="h-full flex flex-col bg-[#0c0d10] text-zinc-100 select-none overflow-y-auto">
      {/* Raycast Header */}
      <div className="p-3.5 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0c0d10]/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <ServiceIcon title={title} url={url} size={20} />
          <div className="min-w-0">
            <h2 className="font-semibold text-xs tracking-tight text-white truncate max-w-[240px]">
              {isCreating ? "New Encrypted Entry" : title || "Untitled"}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-mono text-zinc-500">
                {entry?.client_updated_at ? `Updated ${new Date(entry.client_updated_at).toLocaleDateString()}` : "Zero-Knowledge Item"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFavorite(!favorite)}
            title={favorite ? "Remove favorite" : "Add favorite"}
            className={`p-1.5 rounded-lg transition ${
              favorite
                ? "text-amber-400 bg-amber-400/10 border border-amber-400/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" />
          </button>

          {entry && !isCreating && (
            <button
              onClick={() => onDelete(entry.id)}
              title="Delete item"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3.5 flex-1 max-w-xl">
        {/* Title */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            Item Name <span className="text-[#38BDF8]">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Gmail, Discord, GitHub"
            className="w-full px-3 py-2 bg-[#121316] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        {/* Username / Email */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <User className="w-3 h-3 text-zinc-500" />
              <span>Username or Email</span>
            </label>
            {username && (
              <button
                type="button"
                onClick={() => handleCopy(username, "user")}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedUser ? <Check className="w-3 h-3 text-[#38BDF8]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUser ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. user@example.com"
            className="w-full px-3 py-2 bg-[#121316] border border-white/[0.08] rounded-xl text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        {/* Password with Strength Meter & Generator */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <Key className="w-3 h-3 text-zinc-500" />
              <span>Password</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGenerator(!showGenerator)}
                className="text-[10px] text-zinc-400 hover:text-[#38BDF8] flex items-center gap-1 transition"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate</span>
              </button>
              {password && (
                <button
                  type="button"
                  onClick={() => handleCopy(password, "pass")}
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition"
                >
                  {copiedPass ? <Check className="w-3 h-3 text-[#38BDF8]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPass ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full pl-3 pr-10 py-2 bg-[#121316] border border-white/[0.08] rounded-xl text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 transition"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Real-time Password Strength Meter */}
          {password && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500 font-mono">Strength</span>
                <span className={`font-medium font-mono ${strength.text}`}>{strength.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 h-1">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`rounded-full transition-colors duration-300 ${
                      strength.score >= step ? strength.color : "bg-zinc-800"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Inline Password Generator */}
        {showGenerator && (
          <div className="my-2 p-1 bg-zinc-900/90 border border-white/[0.08] rounded-xl shadow-xl">
            <PasswordGenerator
              onSelectPassword={(newPwd) => {
                setPassword(newPwd);
                setShowGenerator(false);
              }}
              onClose={() => setShowGenerator(false)}
            />
          </div>
        )}

        {/* Website URL */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-zinc-500" />
              <span>Website URL</span>
            </label>
            {url && (
              <a
                href={url.startsWith("http") ? url : `https://${url}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition"
              >
                <span>Visit site</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 bg-[#121316] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        {/* Security Questions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
              <HelpCircle className="w-3 h-3 text-zinc-500" />
              <span>Security Questions ({securityQuestions.length})</span>
            </label>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="text-[10px] text-zinc-400 hover:text-[#38BDF8] flex items-center gap-1 transition font-medium"
            >
              <Plus className="w-3 h-3" />
              <span>Add Question</span>
            </button>
          </div>

          <AnimatePresence initial={false}>
            {securityQuestions.map((q, idx) => {
              const isPreset = PRESET_SECURITY_QUESTIONS.includes(q.question);
              const isRevealed = !!revealedAnswers[idx];
              const isCopied = copiedAnswerIndex === idx;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ type: "spring", damping: 25, stiffness: 350 }}
                  className="p-2.5 bg-[#121316] border border-white/[0.08] rounded-xl space-y-2 relative group"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={isPreset ? q.question : "Custom question..."}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "Custom question...") {
                           handleUpdateQuestion(idx, "question", "");
                        } else {
                          handleUpdateQuestion(idx, "question", val);
                        }
                      }}
                      className="flex-1 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500"
                    >
                      {PRESET_SECURITY_QUESTIONS.map((pq) => (
                        <option key={pq} value={pq}>
                          {pq}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(idx)}
                      title="Remove Question"
                      className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {(!isPreset || q.question === "Custom question...") && (
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => handleUpdateQuestion(idx, "question", e.target.value)}
                      placeholder="Type your custom security question..."
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-white/[0.08] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                    />
                  )}

                  {/* Masked Answer with Reveal, Copy & Fake Answer Generator */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type={isRevealed ? "text" : "password"}
                        value={q.answer}
                        onChange={(e) => handleUpdateQuestion(idx, "answer", e.target.value)}
                        placeholder="Answer (encrypted)"
                        className="w-full pl-2.5 pr-8 py-1.5 bg-zinc-900 border border-white/[0.08] rounded-lg text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedAnswers({ ...revealedAnswers, [idx]: !isRevealed })
                        }
                        className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300 transition"
                        title={isRevealed ? "Hide answer" : "Show answer"}
                      >
                        {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>

                    {q.answer && (
                      <button
                        type="button"
                        onClick={() => handleCopyAnswer(q.answer, idx)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-white/[0.06] text-zinc-400 hover:text-white border border-white/[0.08] transition"
                        title="Copy answer"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-[#38BDF8]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => generateFakeAnswer(idx)}
                      className="px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-[#6366F1]/10 text-zinc-400 hover:text-[#38BDF8] border border-white/[0.08] hover:border-[#6366F1]/30 text-[10px] font-mono flex items-center gap-1 transition"
                      title="Generate high-entropy random fake answer to defeat social engineering"
                    >
                      <Sparkles className="w-3 h-3 text-[#38BDF8]" />
                      <span>Fake Answer</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Tags */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5 mb-1">
            <Tag className="w-3 h-3 text-zinc-500" />
            <span>Tags (comma separated)</span>
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. personal, work, finances"
            className="w-full px-3 py-2 bg-[#121316] border border-white/[0.08] rounded-xl text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        {/* Secure Notes */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5 mb-1">
            <FileText className="w-3 h-3 text-zinc-500" />
            <span>Secure Notes</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Recovery codes, answers to security questions..."
            className="w-full px-3 py-2 bg-[#121316] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none transition"
          />
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <motion.button
            type="submit"
            disabled={saving}
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.01 }}
            className="w-full py-2 px-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span>{saving ? "Encrypting & Syncing..." : "Save Encrypted Item"}</span>
            <span className="kbd-badge text-[9px] bg-white/20 border-white/30 text-white ml-1">Ctrl S</span>
          </motion.button>
        </div>
      </form>
    </div>
  );
};
