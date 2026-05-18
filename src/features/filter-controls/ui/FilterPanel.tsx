import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, Plus, SlidersHorizontal, X } from "lucide-react";
import { useUnit } from "effector-react";
import {
  type FilterParameterDefinition,
  type FilterParameterChangedPayload,
  $addedFilterDefinitions,
  $filterChain,
  $hasActiveFilters,
  FILTER_DEFINITIONS,
  type FilterId,
  filterAdded,
  filterParameterChanged,
  filterRemoved,
  filterToggled,
  filtersReset,
  formatParameterValue,
} from "../../../entities/filter-chain";
import { Button, ListControl, PointPicker, Slider, Toggle } from "../../../shared/ui";

export function FilterPanel() {
  const [openFilterId, setOpenFilterId] = useState<FilterId | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const {
    addedFilterDefinitions,
    filterChain,
    hasActiveFilters,
    addFilter,
    removeFilter,
    resetFilters,
    setParameter,
    toggleFilter,
  } = useUnit({
    addedFilterDefinitions: $addedFilterDefinitions,
    filterChain: $filterChain,
    hasActiveFilters: $hasActiveFilters,
    addFilter: filterAdded,
    removeFilter: filterRemoved,
    resetFilters: filtersReset,
    setParameter: filterParameterChanged,
    toggleFilter: filterToggled,
  });

  const availableFilterDefinitions = FILTER_DEFINITIONS.filter((def) => !filterChain[def.id].added);

  return (
    <aside className="filter-panel" aria-label="Filter controls">
      <Dialog.Root open={showPicker} onOpenChange={setShowPicker}>
        <div className="panel-header">
          <div>
            <p className="panel-header__eyebrow">Effects</p>
            <h2>Filter Stack</h2>
          </div>
          {addedFilterDefinitions.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setShowPicker(true)}
              disabled={availableFilterDefinitions.length === 0}
            >
              Add filter
            </Button>
          ) : null}
        </div>

        <div className="filter-list">
          {addedFilterDefinitions.length === 0 ? (
            <div className="filter-list__empty">
              <SlidersHorizontal size={32} aria-hidden="true" />
              <p>No filters added yet</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setShowPicker(true)}
              >
                Add filter
              </Button>
            </div>
          ) : (
            addedFilterDefinitions.map((definition) => {
              const filterState = filterChain[definition.id];
              const isOpen = openFilterId === definition.id;

              return (
                <section className="filter-section" key={definition.id}>
                  <div className="filter-section__header">
                    <button
                      type="button"
                      className="filter-section__toggle"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFilterId(isOpen ? null : definition.id)}
                    >
                      <SlidersHorizontal size={16} aria-hidden="true" />
                      <span>
                        <strong>{definition.title}</strong>
                        <small>{definition.description}</small>
                      </span>
                      <ChevronDown
                        className={isOpen ? "is-open" : ""}
                        size={16}
                        aria-hidden="true"
                      />
                    </button>
                    <Toggle
                      label={`${definition.title} enabled`}
                      pressed={filterState.enabled}
                      onPressedChange={(_pressed) => toggleFilter(definition.id)}
                    />
                    <button
                      type="button"
                      className="filter-section__remove"
                      aria-label={`Remove ${definition.title} filter`}
                      onClick={() => {
                        if (openFilterId === definition.id) setOpenFilterId(null);
                        removeFilter(definition.id);
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="filter-section__body">
                      {definition.parameters.map((parameter) =>
                        renderParameterControl({
                          disabled: !filterState.enabled,
                          filterId: definition.id,
                          onChange: setParameter,
                          parameter,
                          parameters: filterState.parameters,
                        }),
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })
          )}
        </div>

        {addedFilterDefinitions.length > 0 ? (
          <div className="panel-footer">
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="panel-footer__reset"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              Reset all
            </Button>
          </div>
        ) : null}

        <Dialog.Portal>
          <Dialog.Backdrop className="filter-picker__backdrop" />
          <Dialog.Viewport className="filter-picker__viewport">
            <Dialog.Popup className="filter-picker" aria-label="Choose a filter to add">
              <div className="filter-picker__header">
                <Dialog.Title className="filter-picker__title">Add filter</Dialog.Title>
                <Dialog.Close className="filter-picker__close" aria-label="Close filter picker">
                  <X size={16} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <div className="filter-picker__list">
                {FILTER_DEFINITIONS.map((definition) => {
                  const isAdded = filterChain[definition.id].added;
                  return (
                    <div
                      className={`filter-picker__item${isAdded ? " is-added" : ""}`}
                      key={definition.id}
                    >
                      <div className="filter-picker__item-info">
                        <strong>{definition.title}</strong>
                        <small>{definition.description}</small>
                      </div>
                      <button
                        type="button"
                        className="filter-picker__add"
                        aria-label={
                          isAdded ? `${definition.title} already added` : `Add ${definition.title}`
                        }
                        disabled={isAdded}
                        onClick={() => {
                          addFilter(definition.id);
                          setOpenFilterId(definition.id);
                          setShowPicker(false);
                        }}
                      >
                        {isAdded ? (
                          "Added"
                        ) : (
                          <>
                            <Plus size={13} aria-hidden="true" /> Add
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </aside>
  );
}

function renderParameterControl({
  disabled,
  filterId,
  onChange,
  parameter,
  parameters,
}: {
  disabled: boolean;
  filterId: FilterId;
  onChange: (payload: FilterParameterChangedPayload) => void;
  parameter: FilterParameterDefinition;
  parameters: Record<string, number | string>;
}) {
  if (parameter.type === "point") {
    const xValue =
      typeof parameters[parameter.xId] === "number"
        ? (parameters[parameter.xId] as number)
        : parameter.defaultX;
    const yValue =
      typeof parameters[parameter.yId] === "number"
        ? (parameters[parameter.yId] as number)
        : parameter.defaultY;
    return (
      <PointPicker
        key={parameter.id}
        label={parameter.label}
        x={xValue}
        y={yValue}
        disabled={disabled}
        onValueChange={(x, y) => {
          onChange({ filterId, parameterId: parameter.xId, value: x });
          onChange({ filterId, parameterId: parameter.yId, value: y });
        }}
      />
    );
  }

  if (parameter.type === "select") {
    const value = parameters[parameter.id];
    return (
      <ListControl
        key={parameter.id}
        label={parameter.label}
        options={parameter.options}
        value={typeof value === "string" ? value : parameter.defaultValue}
        disabled={disabled}
        onValueChange={(nextValue) =>
          onChange({
            filterId,
            parameterId: parameter.id,
            value: nextValue,
          })
        }
      />
    );
  }

  const value = parameters[parameter.id];
  const numericValue = typeof value === "number" ? value : parameter.defaultValue;

  return (
    <Slider
      key={parameter.id}
      label={parameter.label}
      min={parameter.min}
      max={parameter.max}
      step={parameter.step}
      value={numericValue}
      valueLabel={formatParameterValue(parameter, numericValue)}
      disabled={disabled}
      onValueChange={(nextValue) =>
        onChange({
          filterId,
          parameterId: parameter.id,
          value: nextValue,
        })
      }
    />
  );
}
