"use client";

import { Camera, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { removeAvatarAction, updateAvatarAction } from "./actions";
import styles from "./settings.module.css";

type AvatarUploadProps = {
  avatar: string | null;
  name: string;
  handle: string;
};

export function AvatarUpload({ avatar, name, handle }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function selectFile(file?: File) {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Подойдут только JPG, PNG или WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Файл должен быть меньше 2 МБ.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className={styles.avatarEditor}>
      <div className={styles.avatarPreview}>
        {preview
          ? <img src={preview} alt="Предпросмотр нового логотипа" />
          : <UserAvatar avatar={avatar} name={name} handle={handle} size={84} />}
        <span><Camera size={15} /></span>
      </div>

      <form className={styles.avatarForm} action={updateAvatarAction}>
        <div>
          <strong>Логотип профиля</strong>
          <p>Квадратное изображение, JPG, PNG или WebP, до 2 МБ.</p>
        </div>
        <label className={styles.fileButton}>
          <Upload size={16} />
          Выбрать файл
          <input
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </label>
        <button className="btn btn-primary btn-small" type="submit" disabled={!preview}>
          Сохранить
        </button>
        {error ? <p className={styles.fileError}>{error}</p> : null}
      </form>

      {avatar ? (
        <form action={removeAvatarAction}>
          <button className="btn btn-ghost btn-small" type="submit">
            <Trash2 size={15} /> Удалить
          </button>
        </form>
      ) : null}
    </div>
  );
}
