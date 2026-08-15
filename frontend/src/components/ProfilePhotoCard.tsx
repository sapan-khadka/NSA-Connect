import { useId, useRef, useState } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { deleteMyAvatar, uploadMyAvatar } from "../lib/members-api";
import { Avatar } from "../design-system/components/Avatar";

type ProfilePhotoCardProps = {
  member: MemberResponse;
  onMemberUpdated: (member: MemberResponse) => void;
};

export function ProfilePhotoCard({
  member,
  onMemberUpdated,
}: ProfilePhotoCardProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const updated = await uploadMyAvatar(file);
      onMemberUpdated(updated);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleRemove() {
    setIsRemoving(true);
    setError(null);
    try {
      const updated = await deleteMyAvatar();
      onMemberUpdated(updated);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <section className="settings-block is-flush" aria-label="Profile photo">
      <h2 className="event-command-kicker">Photo</h2>
      <div className="settings-photo">
        <Avatar
          name={member.full_name}
          memberId={member.id}
          src={member.avatar_url}
          size="xl"
          alt={`${member.full_name} profile photo`}
        />
        <div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif"
            className="sr-only"
            onChange={(event) => void handleFileChange(event.target.files)}
          />
          <div className="settings-photo-actions">
            <button
              type="button"
              disabled={isUploading || isRemoving}
              className="event-command-btn"
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? "Uploading…" : "Change photo"}
            </button>
            {member.avatar_url ? (
              <button
                type="button"
                disabled={isUploading || isRemoving}
                className="event-command-btn"
                onClick={() => void handleRemove()}
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            ) : null}
          </div>
          <p className="settings-field-hint">JPG, PNG, or HEIC</p>
        </div>
      </div>
      {error ? (
        <p className="settings-status is-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
