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
import { uploadButtonRecipe } from "./uploadButtonRecipe";

type ImageUploadButtonProps = {
  variant?: "compact" | "empty";
};

export function ImageUploadButton({ variant = "compact" }: ImageUploadButtonProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { currentImage, selectImage } = useUnit({
    currentImage: $loadedImage,
    selectImage: imageSelected,
  });

  const acceptFile = useCallback(
    (file: File | undefined) => {
      if (file === undefined || !file.type.startsWith("image/")) {
        return;
      }

      releaseLoadedImage(currentImage);
      selectImage(createLoadedImage(file));

      if (inputRef.current !== null) {
        inputRef.current.value = "";
      }
    },
    [currentImage, selectImage],
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
      className={uploadButtonRecipe({ variant })}
      data-dragging={isDragging || undefined}
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
