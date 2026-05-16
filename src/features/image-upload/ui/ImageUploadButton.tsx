import { useCallback, useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Upload } from "lucide-react";
import { useUnit } from "effector-react";
import {
  $loadedImage,
  createLoadedImage,
  imageSelected,
  releaseLoadedImage,
} from "../../../entities/image";
import { filtersReset } from "../../../entities/filter-chain";

type ImageUploadButtonProps = {
  variant?: "compact" | "empty";
};

export function ImageUploadButton({ variant = "compact" }: ImageUploadButtonProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { currentImage, selectImage, resetFilters } = useUnit({
    currentImage: $loadedImage,
    selectImage: imageSelected,
    resetFilters: filtersReset,
  });

  const acceptFile = useCallback(
    (file: File | undefined) => {
      if (file === undefined || !file.type.startsWith("image/")) {
        return;
      }

      releaseLoadedImage(currentImage);
      selectImage(createLoadedImage(file));
      resetFilters();

      if (inputRef.current !== null) {
        inputRef.current.value = "";
      }
    },
    [currentImage, resetFilters, selectImage],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      acceptFile(event.target.files?.[0]);
    },
    [acceptFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragging(false);
      acceptFile(event.dataTransfer.files[0]);
    },
    [acceptFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <label
      htmlFor={inputId}
      className={["upload-button", `upload-button--${variant}`, isDragging ? "is-dragging" : ""]
        .filter(Boolean)
        .join(" ")}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        name="image"
        accept="image/*"
        onChange={handleChange}
      />
      <Upload size={variant === "empty" ? 28 : 16} aria-hidden="true" />
      <span>{currentImage === null ? "Open image" : "Replace image"}</span>
    </label>
  );
}
