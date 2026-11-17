'use client';

import React, { useState } from 'react';
import {
  Layers,
  Droplets,
  Mountain,
  Waves,
  Sliders,
  Eye,
  EyeOff,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  Check,
} from 'lucide-react';
import {
  HAZARD_LAYERS,
  HAZARD_CATEGORIES,
  type HazardLayerId,
  type HazardCategory,
  type BasemapMode,
} from '@/lib/geo/hazard-layers';

interface HazardLegendPanelProps {
  visibleLayers: Record<HazardLayerId, boolean>;
  visibleSeverities: Record<HazardLayerId, number[]>;
  fillOpacity: number;
  basemapMode: BasemapMode;
  onToggleLayer: (id: HazardLayerId) => void;
  onToggleSeverity: (layerId: HazardLayerId, value: number) => void;
  onSetLayerAllSeverities: (layerId: HazardLayerId, enableAll: boolean) => void;
  onSetCategoryVisibility: (category: HazardCategory | 'all', visible: boolean) => void;
  onResetDefaults: () => void;
  onChangeOpacity: (opacity: number) => void;
  onChangeBasemap: (mode: BasemapMode) => void;
  onHidePanel?: () => void;
}

const CATEGORY_ICON_MAP: Record<HazardCategory, typeof Droplets> = {
  flood: Droplets,
  landslide: Mountain,
  storm_surge: Waves,
};

export const HazardLegendPanel = React.memo(function HazardLegendPanel({
  visibleLayers,
  visibleSeverities,
  fillOpacity,
  basemapMode,
  onToggleLayer,
  onToggleSeverity,
  onSetLayerAllSeverities,
  onSetCategoryVisibility,
  onResetDefaults,
  onChangeOpacity,
  onChangeBasemap,
  onHidePanel,
}: HazardLegendPanelProps) {
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | HazardCategory>('all');
  const [expandedLayerId, setExpandedLayerId] = useState<HazardLayerId | null>('flood_100yr');

  const visibleCategories =
    activeCategoryTab === 'all'
      ? HAZARD_CATEGORIES
      : HAZARD_CATEGORIES.filter((c) => c.id === activeCategoryTab);

  const activeCount = HAZARD_LAYERS.filter((l) => visibleLayers[l.id]).length;

  return (
    <aside className="w-full h-full max-h-full bg-white/95 backdrop-blur-md rounded-2xl border border-[#E2E8F0] shadow-2xl flex flex-col overflow-hidden">
      {/* 1. Panel Header */}
      <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]/90 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#004AC6]/10 text-[#004AC6] border border-[#004AC6]/15 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-[#1E293B] truncate">
              Hazard Layers &amp; Controls
            </h2>
            <p className="text-[11px] text-[#505F76] truncate">
              {activeCount} of {HAZARD_LAYERS.length} layers active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onResetDefaults}
            title="Reset default layers"
            className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-[#505F76] hover:text-[#1E293B] hover:bg-slate-200/60 inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={() => onSetCategoryVisibility('all', activeCount === 0)}
            title={activeCount === 0 ? 'Show all layers' : 'Hide all layers'}
            className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-[#004AC6] hover:bg-blue-50 inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            {activeCount === 0 ? (
              <>
                <Eye className="w-3 h-3" />
                <span>All</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" />
                <span>Clear</span>
              </>
            )}
          </button>
          {onHidePanel && (
            <button
              type="button"
              onClick={onHidePanel}
              title="Hide toolbar"
              aria-label="Hide hazard toolbar"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#505F76] hover:text-[#1E293B] hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Scrollable Control Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Category Filter Pills */}
        <div className="grid grid-cols-4 gap-1.5 bg-[#F8FAFC] p-1 rounded-2xl border border-[#E2E8F0]">
          {(
            [
              { id: 'all', label: 'All (9)', icon: Layers },
              { id: 'flood', label: 'Flood', icon: Droplets },
              { id: 'landslide', label: 'Slope', icon: Mountain },
              { id: 'storm_surge', label: 'Surge', icon: Waves },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeCategoryTab === tab.id;
            const hasActiveInTab =
              tab.id === 'all'
                ? activeCount > 0
                : HAZARD_LAYERS.some(
                    (l) => l.category === tab.id && visibleLayers[l.id]
                  );

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategoryTab(tab.id)}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#004AC6] text-white shadow-2xs'
                    : 'text-[#505F76] hover:text-[#1E293B] hover:bg-white'
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {hasActiveInTab && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#004AC6] shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Grouped Hazard Categories (Per-Category Master Toggle + Per-Inundation Controls) */}
        <div className="space-y-3">
          {visibleCategories.map((categoryDef) => {
            const CatIcon = CATEGORY_ICON_MAP[categoryDef.id];
            const catLayers = categoryDef.layerIds
              .map((layerId) => HAZARD_LAYERS.find((l) => l.id === layerId))
              .filter((l): l is NonNullable<typeof l> => Boolean(l));
            const activeInCategory = catLayers.filter((l) => visibleLayers[l.id]).length;
            const isCategoryAnyOn = activeInCategory > 0;
            const isCategoryAllOn = activeInCategory === catLayers.length;

            return (
              <div
                key={categoryDef.id}
                className="hazard-category-card rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/50 overflow-hidden"
              >
                {/* Category Master Control Header */}
                <div className="hazard-category-header px-3 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white shadow-2xs"
                      style={{ backgroundColor: categoryDef.accentColor }}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-[#1E293B] truncate">
                          {categoryDef.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            isCategoryAnyOn
                              ? 'bg-blue-50 text-[#004AC6] border border-blue-200/80'
                              : 'bg-slate-200/70 text-[#757680]'
                          }`}
                        >
                          {activeInCategory}/{catLayers.length}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#757680] block truncate">
                        {categoryDef.description}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCategoryAnyOn && !isCategoryAllOn && (
                      <button
                        type="button"
                        onClick={() => onSetCategoryVisibility(categoryDef.id, true)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#004AC6]/10 text-[#004AC6] hover:bg-[#004AC6]/20 transition-colors cursor-pointer"
                        title={`Turn ON all ${categoryDef.label} layers`}
                      >
                        All ON
                      </button>
                    )}

                    {/* Category Master ON/OFF Switch */}
                    <button
                      type="button"
                      onClick={() =>
                        onSetCategoryVisibility(categoryDef.id, !isCategoryAnyOn)
                      }
                      aria-label={`Toggle all ${categoryDef.label} layers`}
                      title={
                        isCategoryAnyOn
                          ? `Turn OFF all ${categoryDef.label} layers`
                          : `Turn ON all ${categoryDef.label} layers`
                      }
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 cursor-pointer ${
                        isCategoryAnyOn
                          ? 'bg-[#004AC6] justify-end'
                          : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                    </button>
                  </div>
                </div>

                {/* Category Layers List */}
                <div className="p-2 space-y-2">
                  {catLayers.map((layer) => {
                    const isVisible = Boolean(visibleLayers[layer.id]);
                    const isExpanded = expandedLayerId === layer.id;
                    const activeStops =
                      visibleSeverities[layer.id] ??
                      layer.severityStops.map((s) => s.value);
                    const activeStopCount = isVisible ? activeStops.length : 0;
                    const totalStops = layer.severityStops.length;
                    const isAllStopsActive =
                      isVisible && activeStopCount === totalStops;

                    return (
                      <div
                        key={layer.id}
                        className={`rounded-xl border transition-all overflow-hidden ${
                          isVisible
                            ? 'hazard-layer-row-active bg-white border-[#CBD5E1] shadow-2xs'
                            : 'hazard-layer-row-inactive bg-[#F8FAFC]/70 border-[#E2E8F0]'
                        }`}
                      >
                        <div className="p-2.5 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLayerId((prev) =>
                                prev === layer.id ? null : layer.id
                              )
                            }
                            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer bg-transparent"
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/25 shadow-2xs"
                              style={{ backgroundColor: layer.badgeColor }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[#1E293B] truncate">
                                  {layer.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-[#757680] font-medium truncate">
                                  {layer.featureCount.toLocaleString()} poly
                                </span>
                                <span className="text-[10px] text-[#757680]">•</span>
                                {/* Mini Inundation Status Dots */}
                                <span className="inline-flex items-center gap-0.5">
                                  {layer.severityStops.map((stop) => {
                                    const stopOn =
                                      isVisible && activeStops.includes(stop.value);
                                    return (
                                      <span
                                        key={stop.value}
                                        className={`w-2 h-2 rounded-[2px] border transition-opacity ${
                                          stopOn ? 'opacity-100' : 'opacity-25'
                                        }`}
                                        style={{
                                          backgroundColor: stop.color,
                                          borderColor: stop.outlineColor,
                                        }}
                                        title={`${stop.label}: ${stop.depthOrDetail}`}
                                      />
                                    );
                                  })}
                                </span>
                                <span className="text-[10px] font-semibold text-[#505F76]">
                                  {activeStopCount}/{totalStops}
                                </span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#757680] shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#757680] shrink-0" />
                            )}
                          </button>

                          {/* Layer Visibility Switch */}
                          <button
                            type="button"
                            onClick={() => onToggleLayer(layer.id)}
                            aria-label={`Toggle ${layer.name}`}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 cursor-pointer ${
                              isVisible
                                ? 'bg-[#004AC6] justify-end'
                                : 'bg-slate-300 justify-start'
                            }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                          </button>
                        </div>

                        {/* Expanded Per-Inundation / Severity Toggles */}
                        {isExpanded && (
                          <div className="px-2.5 pb-2.5 pt-2 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 space-y-2">
                            <p className="text-[11px] text-[#505F76] leading-relaxed">
                              {layer.description}
                            </p>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#505F76]">
                                Inundation / Severity ({activeStopCount}/{totalStops})
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onSetLayerAllSeverities(layer.id, !isAllStopsActive)
                                }
                                className="text-[10px] font-bold text-[#004AC6] hover:underline cursor-pointer"
                              >
                                {isAllStopsActive ? 'Disable All' : 'Enable All'}
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              {layer.severityStops.map((stop) => {
                                const isStopOn =
                                  isVisible && activeStops.includes(stop.value);

                                return (
                                  <button
                                    key={stop.value}
                                    type="button"
                                    onClick={() => onToggleSeverity(layer.id, stop.value)}
                                    aria-pressed={isStopOn}
                                    className={`w-full flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-xl border transition-all text-left cursor-pointer ${
                                      isStopOn
                                        ? 'hazard-severity-row-active bg-white border-[#004AC6]/40 shadow-2xs'
                                        : 'hazard-severity-row-inactive bg-slate-100/70 border-[#E2E8F0] opacity-70 hover:opacity-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                          isStopOn
                                            ? 'bg-[#004AC6] border-[#004AC6] text-white'
                                            : 'bg-transparent border-slate-400/60 text-transparent'
                                        }`}
                                      >
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      </span>
                                      <span
                                        className="w-3 h-3 rounded-sm shrink-0 border"
                                        style={{
                                          backgroundColor: stop.color,
                                          borderColor: stop.outlineColor,
                                        }}
                                      />
                                      <span className="font-bold text-[#1E293B] truncate">
                                        {stop.label}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-[#505F76] font-medium truncate shrink-0">
                                      {stop.depthOrDetail}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Opacity & Basemap Controls */}
        <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#1E293B] inline-flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#004AC6]" />
                Hazard Layer Opacity
              </span>
              <span className="font-mono font-bold text-[#004AC6]">
                {Math.round(fillOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={95}
              step={5}
              value={Math.round(fillOpacity * 100)}
              onChange={(e) => onChangeOpacity(Number(e.target.value) / 100)}
              className="w-full accent-[#004AC6] cursor-pointer h-1.5 rounded-lg"
            />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
            <span className="text-[11px] font-bold text-[#505F76] uppercase tracking-wider block">
              Basemap Canvas
            </span>
            <div className="grid grid-cols-5 gap-1">
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'light', label: 'Light' },
                  { id: 'dark', label: 'Dark' },
                  { id: 'satellite', label: 'Sat' },
                  { id: 'offline', label: 'Grid' },
                ] as const
              ).map((bm) => (
                <button
                  key={bm.id}
                  type="button"
                  onClick={() => onChangeBasemap(bm.id)}
                  className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    basemapMode === bm.id
                      ? 'bg-[#004AC6] text-white shadow-2xs'
                      : 'bg-white text-[#505F76] border border-[#E2E8F0] hover:text-[#1E293B]'
                  }`}
                >
                  {bm.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
});
