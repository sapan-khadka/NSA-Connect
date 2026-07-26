import { useId, useRef, useState } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { deleteMyAvatar, uploadMyAvatar } from "../lib/members-api";
import { Avatar } from "../design-system/components/Avatar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

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
    <Card padding="md" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Profile photo
        </h2>
        <p className="mt-1 text-sm text-label">
          Shown across discussions, the member directory, and your account menu.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          name={member.full_name}
          src={member.avatar_url}
          size="xl"
          alt={`${member.full_name} profile photo`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif"
            className="sr-only"
            onChange={(event) => void handleFileChange(event.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isUploading || isRemoving}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? "Uploading…" : "Upload photo"}
          </Button>
          {member.avatar_url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isUploading || isRemoving}
              onClick={() => void handleRemove()}
            >
              {isRemoving ? "Removing…" : "Remove"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-overdue" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
