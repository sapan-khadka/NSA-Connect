/**
 * Documents — officer-only files on file for a member (resume, waiver, etc.).
 * Uploads reuse the same Cloudinary / multipart pattern as finance receipts
 * and event photos (FormData + file field).
 */

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";

import { getApiErrorMessage } from "../../lib/auth-api";
import { formatEventDateTime } from "../../lib/format-datetime";
import {
  deleteMemberDocument,
  fetchMemberDocuments,
  MEMBER_DOCUMENT_ACCEPT,
  MEMBER_DOCUMENT_TYPE_LABELS,
  MEMBER_DOCUMENT_TYPES,
  uploadMemberDocument,
  type MemberDocument,
  type MemberDocumentType,
} from "../../lib/member-documents-api";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

type MemberWorkspaceDocumentsProps = {
  memberId: number;
  /** Board+ can view/upload/delete. Others see an unavailable state. */
  canManage: boolean;
};

function DocumentsUnavailable() {
  return (
    <div className="member-workspace-resp-empty">
      <p className="member-workspace-resp-empty-title">Documents unavailable</p>
      <p className="member-workspace-docs-empty-desc">
        Member documents are limited to board officers.
      </p>
    </div>
  );
}

function DocumentsEmpty() {
  return (
    <div className="member-workspace-resp-empty">
      <p className="member-workspace-resp-empty-title">No documents on file.</p>
      <p className="member-workspace-docs-empty-desc">
        Use Upload above to attach a resume, waiver, certificate, or other file.
      </p>
    </div>
  );
}

export function MemberWorkspaceDocuments({
  memberId,
  canManage,
}: MemberWorkspaceDocumentsProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<MemberDocument[]>([]);
  const [isLoading, setIsLoading] = useState(canManage);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<MemberDocumentType>("resume");
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!canManage) {
      setDocuments([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchMemberDocuments(memberId)
      .then((result) => {
        if (!cancelled) {
          setDocuments(result.documents);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setDocuments([]);
          setError(getApiErrorMessage(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [memberId, canManage]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canManage) {
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const created = await uploadMemberDocument(memberId, file, documentType);
      setDocuments((current) => [created, ...current]);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (document: MemberDocument) => {
    if (!document.can_delete || deletingId !== null) {
      return;
    }
    const confirmed = window.confirm(
      `Remove “${document.file_name}” from this member’s file?`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(document.id);
    setError(null);
    try {
      await deleteMemberDocument(memberId, document.id);
      setDocuments((current) =>
        current.filter((entry) => entry.id !== document.id),
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      className="member-workspace-card member-workspace-card--compact member-workspace-docs"
      aria-label="Documents"
    >
      <div className="member-workspace-card-header member-workspace-resp-header">
        <div className="member-workspace-card-heading">
          <span className="member-workspace-card-icon" aria-hidden="true">
            <AppIcon icon={FileText} size="sm" className="text-current" />
          </span>
          <div className="min-w-0">
            <h2 className="member-workspace-card-title">Documents</h2>
            <p className="member-workspace-card-desc">
              Files on file for this member.
            </p>
          </div>
        </div>
      </div>

      <div className="member-workspace-card-body member-workspace-resp-body">
        {!canManage ? <DocumentsUnavailable /> : null}

        {canManage && isLoading ? (
          <p className="member-workspace-resp-loading">Loading documents…</p>
        ) : null}

        {canManage && !isLoading ? (
          <>
            <div className="member-workspace-docs-upload">
              <label
                className="member-workspace-docs-type-label"
                htmlFor={`${fileInputId}-type`}
              >
                Type
              </label>
              <div className="member-workspace-docs-upload-row">
                <select
                  id={`${fileInputId}-type`}
                  className="member-workspace-docs-type"
                  value={documentType}
                  disabled={isUploading}
                  onChange={(event) =>
                    setDocumentType(event.target.value as MemberDocumentType)
                  }
                >
                  {MEMBER_DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MEMBER_DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUploading}
                  onClick={openFilePicker}
                >
                  <AppIcon icon={Upload} size="sm" className="mr-1.5" />
                  {isUploading ? "Uploading…" : "Upload"}
                </Button>
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  type="file"
                  className="sr-only"
                  accept={MEMBER_DOCUMENT_ACCEPT}
                  disabled={isUploading}
                  onChange={(event) => {
                    void handleFileChange(event);
                  }}
                />
              </div>
              <p className="member-workspace-docs-hint">
                PDF, JPEG, PNG, or WebP up to 10 MB.
              </p>
            </div>

            {error ? (
              <p className="ds-field-error mt-2" role="alert">
                {error}
              </p>
            ) : null}

            {documents.length === 0 ? (
              <DocumentsEmpty />
            ) : (
              <ul className="member-workspace-docs-list">
                {documents.map((document) => (
                  <li key={document.id} className="member-workspace-docs-item">
                    <div className="member-workspace-docs-item-main">
                      <p className="member-workspace-docs-name">
                        {document.file_name}
                      </p>
                      <div className="member-workspace-docs-meta">
                        <span className="member-workspace-docs-badge">
                          {MEMBER_DOCUMENT_TYPE_LABELS[document.document_type]}
                        </span>
                        <span>
                          {formatEventDateTime(document.uploaded_at)}
                        </span>
                        <span>by {document.uploaded_by_name}</span>
                      </div>
                    </div>
                    <div className="member-workspace-docs-actions">
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="member-workspace-docs-link"
                      >
                        View
                        <AppIcon
                          icon={ExternalLink}
                          size="sm"
                          className="ml-1"
                        />
                      </a>
                      {document.can_delete ? (
                        <button
                          type="button"
                          className="member-workspace-docs-delete"
                          disabled={deletingId === document.id}
                          onClick={() => {
                            void handleDelete(document);
                          }}
                          aria-label={`Delete ${document.file_name}`}
                        >
                          <AppIcon icon={Trash2} size="sm" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
