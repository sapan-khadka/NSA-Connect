import { FileText, Lock, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import {
  deleteOrgDocument,
  fetchOrgDocuments,
  type OrgDocument,
  type OrgDocumentVisibility,
  uploadOrgDocument,
} from "../lib/org-documents-api";
import { isRoleAtLeast } from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

function visibilityLabel(visibility: OrgDocumentVisibility): string {
  return visibility === "board" ? "Board only" : "All members";
}

export function NsaDocumentsPanel() {
  const { member } = useAuth();
  const isBoard = member ? isRoleAtLeast(member.role, "board") : false;
  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] =
    useState<OrgDocumentVisibility>("public");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setDocuments(await fetchOrgDocuments());
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load documents."));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim() || !isBoard || uploading) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const created = await uploadOrgDocument({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        file,
      });
      setDocuments((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setVisibility("public");
      setFile(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: OrgDocument) {
    if (!isBoard || busyId != null) {
      return;
    }
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
      return;
    }
    setBusyId(doc.id);
    try {
      await deleteOrgDocument(doc.id);
      setDocuments((current) => current.filter((row) => row.id !== doc.id));
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete document."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          NSA Documents
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-label">
          Chapter files the AI Assistant can search. Public documents are
          visible to every member; board-only documents stay private to the
          board.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-overdue" role="alert">
          {error}
        </p>
      ) : null}

      {isBoard ? (
        <form
          onSubmit={(event) => void handleUpload(event)}
          className="rounded-2xl border border-[#EBEBEA] bg-white p-4"
        >
          <p className="text-[13px] font-semibold text-foreground">
            Upload document (PDF)
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[12px] font-medium text-label">
                Title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-foreground"
                placeholder="e.g. Fall 2026 Member Handbook"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[12px] font-medium text-label">
                Visibility
              </span>
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as OrgDocumentVisibility)
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-foreground"
              >
                <option value="public">Public — all members</option>
                <option value="board">Private — board only</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-[12px] font-medium text-label">
              Description (optional)
            </span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-foreground"
              placeholder="Short note for members"
            />
          </label>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-[12px] font-medium text-label">
              PDF file
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-label file:mr-3 file:rounded-lg file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            />
          </label>
          <div className="mt-4">
            <Button
              type="submit"
              size="sm"
              disabled={uploading || !file}
              className="w-full sm:w-auto"
            >
              <AppIcon icon={Upload} size="xs" />
              {uploading ? "Uploading & indexing…" : "Upload for AI + members"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-[#EBEBEA] bg-white">
        {loading ? (
          <p className="px-4 py-6 text-sm text-label">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-label">
            No chapter documents yet.
            {isBoard
              ? " Upload a PDF above so the AI can answer from it."
              : " Board members can upload public handbooks and private board files."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-start gap-3 px-4 py-3.5"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F3F2] text-foreground">
                  <AppIcon
                    icon={doc.visibility === "board" ? Lock : FileText}
                    size="sm"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {doc.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-label">
                    {visibilityLabel(doc.visibility)}
                    {doc.chunk_count > 0
                      ? ` · AI indexed (${doc.chunk_count} sections)`
                      : ""}
                    {doc.uploaded_by_name
                      ? ` · ${doc.uploaded_by_name}`
                      : ""}
                  </p>
                  {doc.description ? (
                    <p className="mt-1 text-[13px] text-gray-600">
                      {doc.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {doc.file_url ? (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      Open
                    </a>
                  ) : null}
                  {isBoard ? (
                    <button
                      type="button"
                      aria-label={`Delete ${doc.title}`}
                      disabled={busyId === doc.id}
                      onClick={() => void handleDelete(doc)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-label transition hover:bg-overdue-surface hover:text-overdue"
                    >
                      <AppIcon icon={Trash2} size="xs" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
