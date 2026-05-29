import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Download, FileUp, RefreshCcw, Upload } from "lucide-react";
import { Button, buttonRecipe } from "../../../shared/ui";
import { css, cx } from "styled-system/css";
import {
  convertCubeToProjectLutPng,
  makeProjectLutFilename,
  parseCubeLut,
  type CubeLut,
} from "../lib/cubeLut";
import { formatFileSize } from "../../../shared/lib/format";

const metaContainerClass = css({
  display: "flex",
  minWidth: "0",
  flexWrap: "wrap",
  gap: "6px",
  justifyContent: "center",
  color: "text.dim",
  "@media (max-width: 820px)": {
    justifyContent: "flex-start",
  },
});

const metaChipClass = css({
  minWidth: "0",
  maxWidth: "220px",
  overflow: "hidden",
  padding: "3px 8px",
  border: "1px solid",
  borderColor: "outline",
  borderRadius: "full",
  background: "surface",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const metaNameChipClass = cx(metaChipClass, css({ color: "text.muted" }));

type ConversionResult = {
  cube: CubeLut;
  file: File;
  fileName: string;
  objectUrl: string;
};

export function LutConverterPage() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);

  useEffect(
    () => () => {
      if (result !== null) {
        URL.revokeObjectURL(result.objectUrl);
      }
    },
    [result],
  );

  const resetInput = useCallback(() => {
    if (inputRef.current !== null) {
      inputRef.current.value = "";
    }
  }, []);

  const convertFile = useCallback(
    async (file: File | undefined) => {
      if (file === undefined) {
        return;
      }

      if (!file.name.toLowerCase().endsWith(".cube")) {
        setError("Upload a .cube LUT file.");
        resetInput();
        return;
      }

      setIsConverting(true);
      setError(null);

      try {
        const text = await file.text();
        const cube = parseCubeLut(text);
        const blob = await convertCubeToProjectLutPng(cube);
        const objectUrl = URL.createObjectURL(blob);

        setResult((previousResult) => {
          if (previousResult !== null) {
            URL.revokeObjectURL(previousResult.objectUrl);
          }

          return {
            cube,
            file,
            fileName: makeProjectLutFilename(file.name),
            objectUrl,
          };
        });
      } catch (unknownError) {
        setResult((previousResult) => {
          if (previousResult !== null) {
            URL.revokeObjectURL(previousResult.objectUrl);
          }

          return null;
        });
        setError(unknownError instanceof Error ? unknownError.message : "Could not convert LUT.");
      } finally {
        setIsConverting(false);
        resetInput();
      }
    },
    [resetInput],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void convertFile(event.target.files?.[0]);
    },
    [convertFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragging(false);
      void convertFile(event.dataTransfer.files[0]);
    },
    [convertFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleReset = useCallback(() => {
    setError(null);
    setResult((previousResult) => {
      if (previousResult !== null) {
        URL.revokeObjectURL(previousResult.objectUrl);
      }

      return null;
    });
    resetInput();
  }, [resetInput]);

  return (
    <main className="app-shell lut-converter-shell">
      <section className="lut-converter" aria-label="HueModa LUT converter">
        <header className="lut-converter__header">
          <div className="editor-title">
            <h1>LUT Converter</h1>
          </div>

          <div className={metaContainerClass} aria-live="polite">
            {result === null ? (
              <span className={metaChipClass}>No LUT loaded</span>
            ) : (
              <>
                <span className={metaNameChipClass}>{result.file.name}</span>
                <span className={metaChipClass}>{formatFileSize(result.file.size)}</span>
                <span className={metaChipClass}>{result.cube.size}^3</span>
              </>
            )}
          </div>

          <div className="editor-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<RefreshCcw size={16} />}
              onClick={handleReset}
              disabled={result === null && error === null}
            >
              Reset
            </Button>
          </div>
        </header>

        <section className="lut-converter__workspace">
          <label
            htmlFor={inputId}
            className={[
              "lut-dropzone",
              isDragging ? "is-dragging" : "",
              isConverting ? "is-converting" : "",
            ]
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
              name="lut"
              accept=".cube,application/octet-stream,text/plain"
              disabled={isConverting}
              onChange={handleChange}
            />
            <Upload size={28} aria-hidden="true" />
            <span>{isConverting ? "Converting LUT" : "Drop .cube file or browse"}</span>
          </label>

          <aside className="lut-converter__panel" aria-live="polite">
            {error === null ? null : (
              <div className="lut-converter__error" role="alert">
                {error}
              </div>
            )}

            {result === null ? (
              <div className="lut-converter__empty">
                <FileUp size={24} aria-hidden="true" />
                <p>512x512 PNG atlas output</p>
              </div>
            ) : (
              <div className="lut-result">
                <img
                  className="lut-result__preview"
                  src={result.objectUrl}
                  alt={`${result.file.name} atlas preview`}
                />

                <dl className="lut-result__meta">
                  <div>
                    <dt>Title</dt>
                    <dd>{result.cube.title ?? "Untitled"}</dd>
                  </div>
                  <div>
                    <dt>Input</dt>
                    <dd>{result.cube.size}^3 .cube</dd>
                  </div>
                  <div>
                    <dt>Output</dt>
                    <dd>64^3 / 8x8 / 512x512</dd>
                  </div>
                </dl>

                <a
                  className={cx(
                    buttonRecipe({ variant: "primary", size: "md" }),
                    css({ width: "fit-content", textDecoration: "none" }),
                  )}
                  href={result.objectUrl}
                  download={result.fileName}
                >
                  <span className={css({ display: "grid", placeItems: "center" })}>
                    <Download size={16} aria-hidden="true" />
                  </span>
                  <span>Download PNG</span>
                </a>
              </div>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}
