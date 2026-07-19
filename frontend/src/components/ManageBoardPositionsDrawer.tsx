/**
 * President-only catalog manager for custom board positions.
 */

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";

import { Drawer } from "../design-system/components/feedback/Drawer";
import { getApiErrorMessage } from "../lib/api-error";
import {
  archiveCustomBoardPosition,
  createCustomBoardPosition,
  fetchMemberPositionCatalog,
  renameCustomBoardPosition,
  type CustomBoardPositionRecord,
  type MemberPositionCatalog,
} from "../lib/members-api";
import { Button } from "./ui/Button";

type ManageBoardPositionsDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCatalogChanged?: () => void;
};

export function ManageBoardPositionsDrawer({
  open,
  onClose,
  onCatalogChanged,
}: ManageBoardPositionsDrawerProps) {
  const addFieldId = useId();
  const [catalog, setCatalog] = useState<MemberPositionCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<number | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchMemberPositionCatalog({ includeArchived: true });
      setCatalog(next);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadCatalog();
  }, [open, loadCatalog]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError("Enter a position name.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createCustomBoardPosition(name);
      setNewName("");
      await loadCatalog();
      onCatalogChanged?.();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(position: CustomBoardPositionRecord) {
    const name = renameValue.trim();
    if (!name) {
      setError("Enter a position name.");
      return;
    }
    setBusyId(position.id);
    setError(null);
    try {
      await renameCustomBoardPosition(position.id, name);
      setRenamingId(null);
      setRenameValue("");
      await loadCatalog();
      onCatalogChanged?.();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(position: CustomBoardPositionRecord) {
    setBusyId(position.id);
    setError(null);
    try {
      await archiveCustomBoardPosition(position.id);
      setArchiveConfirmId(null);
      await loadCatalog();
      onCatalogChanged?.();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  const activeCustom = catalog?.custom.filter((item) => item.is_active) ?? [];
  const archivedCustom = catalog?.custom.filter((item) => !item.is_active) ?? [];
  const builtIn = catalog?.built_in.filter((item) => item.key !== "member") ?? [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="md"
      closeOnBackdrop
      showClose
      title="Manage board positions"
      description="Built-in officer seats stay fixed. Add custom board titles for other single-holder seats."
    >
      <div className="flex flex-col gap-6 p-1">
        {error ? (
          <p role="alert" className="ds-field-error">
            {error}
          </p>
        ) : null}

        {loading && !catalog ? (
          <p className="text-sm text-label">Loading positions…</p>
        ) : null}

        <section aria-label="Built-in board positions">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Built-in positions
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {builtIn.map((position) => (
              <li
                key={position.key}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  {position.label}
                </span>
                <span className="text-xs text-label">Protected</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Custom board positions">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Custom positions
          </h3>
          <form
            className="mb-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              void handleCreate(event);
            }}
          >
            <label className="sr-only" htmlFor={addFieldId}>
              New custom position name
            </label>
            <input
              id={addFieldId}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Cultural Lead"
              maxLength={120}
              className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creating}
              disabled={creating}
            >
              Add
            </Button>
          </form>

          {activeCustom.length === 0 ? (
            <p className="text-sm text-label">No custom positions yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {activeCustom.map((position) => (
                <li key={position.id} className="flex flex-col gap-2 px-3 py-3">
                  {renamingId === position.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        aria-label={`Rename ${position.name}`}
                        maxLength={120}
                        className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          loading={busyId === position.id}
                          disabled={busyId === position.id}
                          onClick={() => {
                            void handleRename(position);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === position.id}
                          onClick={() => {
                            setRenamingId(null);
                            setRenameValue("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {position.name}
                        </p>
                        <p className="text-xs text-label">
                          {position.holder
                            ? `Held by ${position.holder.full_name}`
                            : "Unassigned"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === position.id}
                          onClick={() => {
                            setRenamingId(position.id);
                            setRenameValue(position.name);
                            setArchiveConfirmId(null);
                          }}
                        >
                          Rename
                        </Button>
                        {archiveConfirmId === position.id ? (
                          <>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              loading={busyId === position.id}
                              disabled={busyId === position.id}
                              onClick={() => {
                                void handleArchive(position);
                              }}
                            >
                              Confirm archive
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busyId === position.id}
                              onClick={() => setArchiveConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyId === position.id}
                            onClick={() => setArchiveConfirmId(position.id)}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {archivedCustom.length > 0 ? (
          <section aria-label="Archived custom positions">
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Archived
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border opacity-80">
              {archivedCustom.map((position) => (
                <li
                  key={position.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span>{position.name}</span>
                  <span className="text-xs text-label">Archived</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
