import React, { useState, useMemo, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { VaultEntry, SaveEntryInput, VaultCategory } from "../types";
import { Sidebar } from "./Sidebar";
import { ItemList } from "./ItemList";
import { ItemInspector } from "./ItemInspector";
import { CreateLoginModal } from "./modals/CreateLoginModal";
import { AddCardModal } from "./modals/AddCardModal";
import { AddIdModal } from "./modals/AddIdModal";
import { SettingsModal } from "./modals/SettingsModal";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { UpdateModal } from "./UpdateModal";
import { getEntryCategory, isEntryArchived, isEntryTrash } from "../services/entryHelpers";
import { checkForAppUpdate, UpdateInfo } from "../services/updater";

interface VaultViewProps {
  entries: VaultEntry[];
  userEmail?: string | null;
  onSaveEntry: (input: SaveEntryInput) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onLock: () => void;
  onLogout?: () => void;
  syncStatus?: "synced" | "syncing" | "offline" | "error";
  onTriggerSync?: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  entries,
  userEmail,
  onSaveEntry,
  onDeleteEntry,
  onLock,
  onLogout,
  syncStatus = "synced",
  onTriggerSync,
}) => {
  const [activeCategory, setActiveCategory] = useState<VaultCategory>("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Modals
  const [showCreateLogin, setShowCreateLogin] = useState(false);
  const [editingLoginEntry, setEditingLoginEntry] = useState<VaultEntry | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddId, setShowAddId] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Check for updates quietly on mount
  useEffect(() => {
    checkForAppUpdate().then((info) => {
      if (info) setUpdateInfo(info);
    });
  }, []);

  // Compute category counts dynamically
  const counts = useMemo(() => {
    let all = 0;
    let logins = 0;
    let cards = 0;
    let ids = 0;
    let archive = 0;
    let trash = 0;

    entries.forEach((entry) => {
      const isArch = isEntryArchived(entry);
      const isTr = isEntryTrash(entry);
      const cat = getEntryCategory(entry);

      if (isTr) {
        trash++;
      } else if (isArch) {
        archive++;
      } else {
        all++;
        if (cat === "login") logins++;
        if (cat === "card") cards++;
        if (cat === "id") ids++;
      }
    });

    return { all, logins, cards, ids, archive, trash };
  }, [entries]);

  // Set default selection when category changes or entries update
  useEffect(() => {
    if (!selectedEntryId && entries.length > 0) {
      setSelectedEntryId(entries[0].id);
    }
  }, [entries, selectedEntryId]);

  const selectedEntry = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) || null;
  }, [entries, selectedEntryId]);

  // Record actions
  const handleToggleFavorite = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    await onSaveEntry({
      id: entry.id,
      title: entry.title,
      username: entry.username || undefined,
      password: entry.password || undefined,
      url: entry.url || undefined,
      notes: entry.notes || undefined,
      tags: entry.tags,
      security_questions: entry.security_questions,
      favorite: !entry.favorite,
    });
  };

  const handleArchive = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const currentTags = entry.tags || [];
    const newTags = currentTags.includes("status:archived")
      ? currentTags
      : [...currentTags, "status:archived"];

    await onSaveEntry({
      id: entry.id,
      title: entry.title,
      username: entry.username || undefined,
      password: entry.password || undefined,
      url: entry.url || undefined,
      notes: entry.notes || undefined,
      tags: newTags,
      security_questions: entry.security_questions,
      favorite: entry.favorite,
    });
  };

  const handleUnarchive = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const newTags = (entry.tags || []).filter((t) => t !== "status:archived" && t !== "archived");

    await onSaveEntry({
      id: entry.id,
      title: entry.title,
      username: entry.username || undefined,
      password: entry.password || undefined,
      url: entry.url || undefined,
      notes: entry.notes || undefined,
      tags: newTags,
      security_questions: entry.security_questions,
      favorite: entry.favorite,
    });
  };

  const handleMoveToTrash = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const currentTags = entry.tags || [];
    const newTags = currentTags.includes("status:trash")
      ? currentTags
      : [...currentTags, "status:trash"];

    await onSaveEntry({
      id: entry.id,
      title: entry.title,
      username: entry.username || undefined,
      password: entry.password || undefined,
      url: entry.url || undefined,
      notes: entry.notes || undefined,
      tags: newTags,
      security_questions: entry.security_questions,
      favorite: entry.favorite,
    });
  };

  const handleRestoreFromTrash = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const newTags = (entry.tags || []).filter((t) => t !== "status:trash" && t !== "trash");

    await onSaveEntry({
      id: entry.id,
      title: entry.title,
      username: entry.username || undefined,
      password: entry.password || undefined,
      url: entry.url || undefined,
      notes: entry.notes || undefined,
      tags: newTags,
      security_questions: entry.security_questions,
      favorite: entry.favorite,
    });
  };

  const handlePermanentDelete = async (id: string) => {
    if (window.confirm("Permanently shred this record from encrypted storage?")) {
      await onDeleteEntry(id);
      if (selectedEntryId === id) {
        setSelectedEntryId(null);
      }
    }
  };

  const handleEmptyTrash = async () => {
    if (window.confirm("Permanently shred all items currently in the Trash?")) {
      const trashItems = entries.filter((e) => isEntryTrash(e));
      for (const item of trashItems) {
        await onDeleteEntry(item.id);
      }
      setSelectedEntryId(null);
    }
  };

  const handleEditEntry = (entry: VaultEntry) => {
    const cat = getEntryCategory(entry);
    if (cat === "card") {
      setShowAddCard(true);
    } else if (cat === "id") {
      setShowAddId(true);
    } else {
      setEditingLoginEntry(entry);
      setShowCreateLogin(true);
    }
  };

  const handlePurgeAccount = async () => {
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0D0F17] overflow-hidden select-none font-sans">
      {/* Column 1: Standardized V2 Navigation Sidebar */}
      <Sidebar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        counts={counts}
        syncStatus={syncStatus}
        onOpenSettings={() => setShowSettings(true)}
        onTriggerSync={() => onTriggerSync && onTriggerSync()}
        onLockVault={onLock}
      />

      {/* Column 2: Aggregated / Category Item List */}
      <ItemList
        entries={entries}
        selectedEntryId={selectedEntryId}
        onSelectEntry={setSelectedEntryId}
        activeCategory={activeCategory}
        onOpenCreateLogin={() => {
          setEditingLoginEntry(null);
          setShowCreateLogin(true);
        }}
        onOpenAddCard={() => setShowAddCard(true)}
        onOpenAddId={() => setShowAddId(true)}
        onEmptyTrash={handleEmptyTrash}
      />

      {/* Column 3: Rich Item Detail Inspector */}
      <ItemInspector
        entry={selectedEntry}
        activeCategory={activeCategory}
        onEdit={handleEditEntry}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onMoveToTrash={handleMoveToTrash}
        onRestoreFromTrash={handleRestoreFromTrash}
        onPermanentDelete={handlePermanentDelete}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Modals */}
      <AnimatePresence>
        {showCreateLogin && (
          <CreateLoginModal
            key="modal-create-login"
            initialEntry={editingLoginEntry}
            onSave={onSaveEntry}
            onClose={() => {
              setShowCreateLogin(false);
              setEditingLoginEntry(null);
            }}
          />
        )}

        {showAddCard && (
          <AddCardModal
            key="modal-add-card"
            onSave={onSaveEntry}
            onClose={() => setShowAddCard(false)}
          />
        )}

        {showAddId && (
          <AddIdModal
            key="modal-add-id"
            onSave={onSaveEntry}
            onClose={() => setShowAddId(false)}
          />
        )}

        {showSettings && (
          <SettingsModal
            key="modal-settings"
            userEmail={userEmail}
            onClose={() => setShowSettings(false)}
            onOpenChangePassword={() => setShowChangePassword(true)}
            onPurgeAccount={handlePurgeAccount}
          />
        )}

        {showChangePassword && (
          <ChangePasswordModal
            key="modal-change-password"
            onClose={() => setShowChangePassword(false)}
            onSuccess={() => setShowChangePassword(false)}
          />
        )}

        {showUpdateModal && (
          <UpdateModal
            key="modal-update"
            updateInfo={updateInfo}
            isOpen={showUpdateModal}
            onClose={() => setShowUpdateModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
