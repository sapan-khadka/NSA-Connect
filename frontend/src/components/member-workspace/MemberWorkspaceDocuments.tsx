/**
 * Documents — per-owner (self) or board+ access for member files.
 * Uploads reuse Cloudinary / multipart (same as finance receipts & event photos).
 */

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ExternalLink, FileText, RefreshCw, Trash2, Upload } from "lucide-react";

import { getApiErrorMessage } from "../../lib/auth-api";
import { formatEventDateTime } from "../../lib/format-datetime";
import {
  deleteMemberDocument,
  fetchMemberDocuments,
  filterDocumentsByCategory,
  MEMBER_DOCUMENT_ACCEPT,
  MEMBER_DOCUMENT_TYPE_LABELS,
  MEMBER_DOCUMENT_TYPES,
  PERSONAL_RECORDS_UPLOAD_CAPTION,
  replaceMemberDocument,
  uploadMemberDocument,
  type MemberDocument,
  type MemberDocumentCategoryFilter,
  type MemberDocumentType,
} from "../../lib/member-documents-api";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

type MemberWorkspaceDocumentsProps = {
  memberId: number;
  /** Self or board+ may manage; others see unavailable. */
  canManage: boolean;
};

function DocumentsUnavailable() {
  return (
    <div className="member-workspace-resp-empty">
      <p className="member-workspace-resp-empty-title">Documents unavailable</p>
      <p className="member-workspace-docs-empty-desc">
        You can manage documents on your own profile. Officers can view any
        member’s files.
      </p>
    </div>
  );
}

function DocumentsEmpty() {
  return (
    <div className="member-workspace-resp-empty">
      <p className="member-workspace-resp-empty-title">No documents on file.</p>
      <p className="member-workspace-docs-empty-desc">
        Use Upload above to attach a resume, waiver, personal record,
        certificate, or other file.
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
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<MemberDocument[]>([]);
  const [isLoading, setIsLoading] = useState(canManage);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<MemberDocumentType>("resume");
  const [categoryFilter, setCategoryFilter] =
    useState<MemberDocumentCategoryFilter>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [replacingId, setReplacingId] = useState<number | null>(null);
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

  const visibleDocuments = useMemo(
    () => filterDocumentsByCategory(documents, categoryFilter),
    [documents, categoryFilter],
  );

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openReplacePicker = (documentId: number) => {
    setReplacingId(documentId);
    // Defer click so state is set before the change handler runs.
    window.setTimeout(() => {
      replaceInputRef.current?.click();
    }, 0);
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

  const handleReplaceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const documentId = replacingId;
    event.target.value = "";
    if (!file || !canManage || documentId === null) {
      setReplacingId(null);
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const updated = await replaceMemberDocument(memberId, documentId, file, {
        documentType,
        fileName: file.name,
      });
      setDocuments((current) =>
        current.map((entry) => (entry.id === documentId ? updated : entry)),
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsUploading(false);
      setReplacingId(null);
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
                Category
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
                  {isUploading && replacingId === null ? "Uploading…" : "Upload"}
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
                <input
                  ref={replaceInputRef}
                  type="file"
                  className="sr-only"
                  accept={MEMBER_DOCUMENT_ACCEPT}
                  disabled={isUploading}
                  onChange={(event) => {
                    void handleReplaceChange(event);
                  }}
                />
              </div>
              <p className="member-workspace-docs-hint">
                PDF, JPEG, PNG, or WebP up to 10 MB.
              </p>
              {documentType === "personal_records" ? (
                <p className="member-workspace-docs-caption">
                  {PERSONAL_RECORDS_UPLOAD_CAPTION}
                </p>
              ) : null}
            </div>

            {documents.length > 0 ? (
              <div className="member-workspace-docs-filter">
                <label
                  className="member-workspace-docs-type-label"
                  htmlFor={`${fileInputId}-filter`}
                >
                  Filter
                </label>
                <select
                  id={`${fileInputId}-filter`}
                  className="member-workspace-docs-type"
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(
                      event.target.value as MemberDocumentCategoryFilter,
                    )
                  }
                >
                  <option value="all">All categories</option>
                  {MEMBER_DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MEMBER_DOCUMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {error ? (
              <p className="ds-field-error mt-2" role="alert">
                {error}
              </p>
            ) : null}

            {documents.length === 0 ? (
              <DocumentsEmpty />
            ) : visibleDocuments.length === 0 ? (
              <div className="member-workspace-resp-empty">
                <p className="member-workspace-resp-empty-title">
                  No documents in this category.
                </p>
              </div>
            ) : (
              <ul className="member-workspace-docs-list">
                {visibleDocuments.map((document) => (
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
                      {document.can_replace ? (
                        <button
                          type="button"
                          className="member-workspace-docs-delete"
                          disabled={isUploading || deletingId !== null}
                          onClick={() => openReplacePicker(document.id)}
                          aria-label={`Replace ${document.file_name}`}
                          title="Replace file"
                        >
                          <AppIcon icon={RefreshCw} size="sm" />
                        </button>
                      ) : null}
                      {document.can_delete ? (
                        <button
                          type="button"
                          className="member-workspace-docs-delete"
                          disabled={deletingId === document.id || isUploading}
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
