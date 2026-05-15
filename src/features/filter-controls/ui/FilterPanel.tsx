import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useUnit } from "effector-react";
import {
  $filterChain,
  $hasActiveFilters,
  FILTER_DEFINITIONS,
  type FilterId,
  filterParameterChanged,
  filterToggled,
  filtersReset,
  formatParameterValue,
} from "../../../entities/filter-chain/model";
import { Button, Slider, Toggle } from "../../../shared/ui";

export function FilterPanel() {
  const [openFilterId, setOpenFilterId] = useState<FilterId>("tone");
  const { filterChain, hasActiveFilters, resetFilters, setParameter, toggleFilter } = useUnit({
    filterChain: $filterChain,
    hasActiveFilters: $hasActiveFilters,
    resetFilters: filtersReset,
    setParameter: filterParameterChanged,
    toggleFilter: filterToggled,
  });

  return (
    <aside className="filter-panel" aria-label="Filter controls">
      <div className="panel-header">
        <div>
          <p className="panel-header__eyebrow">Effects</p>
          <h2>Filter Stack</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
        >
          Reset all
        </Button>
      </div>

      <div className="filter-list">
        {FILTER_DEFINITIONS.map((definition) => {
          const filterState = filterChain[definition.id];
          const isOpen = openFilterId === definition.id;

          return (
            <section className="filter-section" key={definition.id}>
              <div className="filter-section__header">
                <button
                  type="button"
                  className="filter-section__toggle"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFilterId(definition.id)}
                >
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  <span>
                    <strong>{definition.title}</strong>
                    <small>{definition.description}</small>
                  </span>
                  <ChevronDown className={isOpen ? "is-open" : ""} size={16} aria-hidden="true" />
                </button>
                <Toggle
                  label={`${definition.title} enabled`}
                  pressed={filterState.enabled}
                  onPressedChange={() => toggleFilter(definition.id)}
                />
              </div>

              {isOpen ? (
                <div className="filter-section__body">
                  {definition.parameters.map((parameter) => (
                    <Slider
                      key={parameter.id}
                      label={parameter.label}
                      min={parameter.min}
                      max={parameter.max}
                      step={parameter.step}
                      value={filterState.parameters[parameter.id]}
                      valueLabel={formatParameterValue(
                        parameter,
                        filterState.parameters[parameter.id],
                      )}
                      disabled={!filterState.enabled}
                      onValueChange={(value) =>
                        setParameter({
                          filterId: definition.id,
                          parameterId: parameter.id,
                          value,
                        })
                      }
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
