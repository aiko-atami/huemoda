import { Dialog } from "@base-ui/react/dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterPanelBody } from "./FilterPanel";

/**
 * Compact presentation of the filter controls: a floating "Filters" button that
 * opens the same {@link FilterPanelBody} inside a bottom sheet. Used below the
 * compact breakpoint where a docked side panel would crowd the canvas.
 */
export function FilterSheet() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="filter-sheet__trigger" aria-label="Open filter controls">
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span>Filters</span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="filter-sheet__backdrop" />
        <Dialog.Popup className="filter-sheet" aria-label="Filter controls">
          <div className="filter-sheet__grabber" aria-hidden="true" />
          <Dialog.Close className="filter-sheet__close" aria-label="Close filter controls">
            <X size={16} aria-hidden="true" />
          </Dialog.Close>
          <FilterPanelBody />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
