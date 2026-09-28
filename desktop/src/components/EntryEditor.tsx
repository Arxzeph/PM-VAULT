import React, { useState, useEffect } from "react";
import { VaultEntry, SaveEntryInput } from "../types";
import { PasswordGenerator } from "./PasswordGenerator";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  Trash2,
  Save,
  X,
  Star,
  Globe,
  User,
  Key,
  FileText,
  Tag,
} from "lucide-react";

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
    } else if (isCreating) {
      setTitle("");
      setUsername("");
      setPassword("");
      setUrl("");
      setNotes("");
      setTagsInput("");
      setFavorite(false);
    }
  }, [entry, isCreating]);

  const handleCopy = async (text: string, type: "user" | "pass") => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    if (type === "user") {
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

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
        tags,
        favorite,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 select-none overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFavorite(!favorite)}
            title={favorite ? "Remove from favorites" : "Add to favorites"}
            className={`p-1.5 rounded-lg transition ${
              favorite ? "text-amber-400 bg-amber-400/10" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Star className="w-5 h-5 fill-current" />
          </button>
          <h2 className="font-semibold text-base truncate max-w-[220px]">
            {isCreating ? "New Item" : title || "Untitled"}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {entry && !isCreating && (
            <button
              onClick={() => onDelete(entry.id)}
              title="Delete item"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. GitHub, Netflix, Bank"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Username / Email */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Username / Email</span>
            </label>
            {username && (
              <button
                type="button"
                onClick={() => handleCopy(username, "user")}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copiedUser ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUser ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username or email"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Password with Generator */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Password</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowGenerator(!showGenerator)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate</span>
              </button>
              {password && (
                <button
                  type="button"
                  onClick={() => handleCopy(password, "pass")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  {copiedPass ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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
              className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Inline Password Generator Popover */}
        {showGenerator && (
          <div className="my-2">
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
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>Website URL</span>
            </label>
            {url && (
              <a
                href={url.startsWith("http") ? url : `https://${url}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Visit</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Tag className="w-3.5 h-3.5 text-slate-500" />
            <span>Tags (comma separated)</span>
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. personal, finance, dev"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Secure Notes</span>
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Recovery codes, security questions, notes..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Action Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Encrypting & Saving..." : "Save Entry"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
