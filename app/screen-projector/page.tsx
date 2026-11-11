'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Edit2,
  Trash2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Projector,
  User,
  Globe,
  RotateCcw,
  LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayoutShell } from '@/components/nav-route';
import { getCachedProjectorScreens, setCachedProjectorScreens } from '@/lib/cache/screen-data-cache';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CustomDropdown, CustomDropdownOption } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  computeAutoGrid,
  GridPreset,
  LayoutProfileKey,
  normalizeWebLink,
  isValidWebLink,
  getDisplayHost,
} from '@/lib/projector/auto-grid';

const LOCAL_ORDER_STORAGE_KEY = 'pdrrmo_projector_local_orders_v1';

export interface ProjectorScreenItem {
  id: string;
  name: string;
  webLink: string;
  sortOrder: number;
  deviceOrders: Partial<Record<LayoutProfileKey, number>>;
  isActive: boolean;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

type LocalOrderMap = Partial<Record<LayoutProfileKey, string[]>>;

interface ProjectorScreenRow {
  id: string;
  name: string;
  web_link: string;
  sort_order: number | null;
  device_orders: Partial<Record<LayoutProfileKey, number>> | null;
  is_active: boolean | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred.'): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}

function loadLocalOrders(): LocalOrderMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_ORDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalOrderMap) : {};
  } catch {
    return {};
  }
}

function saveLocalOrders(orders: LocalOrderMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_ORDER_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Ignore storage quota errors
  }
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 w-full h-[calc(100dvh-145px)] min-h-[420px]">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col"
        >
          <div className="h-7 bg-[#F8FAFC] border-b border-[#E2E8F0] px-2.5 flex items-center justify-between">
            <Skeleton variant="rounded" className="h-3 w-28" />
            <div className="flex items-center gap-1">
              <Skeleton variant="circular" className="w-4 h-4" />
              <Skeleton variant="circular" className="w-4 h-4" />
            </div>
          </div>
          <Skeleton variant="rectangular" className="w-full flex-1" />
        </div>
      ))}
    </div>
  );
}

export default function ScreenProjectorPage() {
  const { user, profile, canWrite } = useAuth();
  const canManage = canWrite('Screen Projector');

  const currentActorId = user?.id || profile?.id || null;
  const currentActorName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    'System User';

  // Database state (hydrated synchronously from in-memory cache)
  const initialCachedScreens = getCachedProjectorScreens();
  const [screens, setScreens] = useState<ProjectorScreenItem[]>(() => (initialCachedScreens as ProjectorScreenItem[]) || []);
  const [isLoading, setIsLoading] = useState(!initialCachedScreens);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tableMissingNotice, setTableMissingNotice] = useState(false);

  // Per-device local fallback orders (used for View-Only local moving or offline order overrides)
  const [localOrders, setLocalOrders] = useState<LocalOrderMap>({});

  // Layout & Fullscreen State
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1280, height: 720 });
  const [gridPreset, setGridPreset] = useState<GridPreset>('auto');
  const [isGridFullscreen, setIsGridFullscreen] = useState(false);
  const [focusedScreenId, setFocusedScreenId] = useState<string | null>(null);

  // Iframe reload versions
  const [reloadKeys, setReloadKeys] = useState<Record<string, number>>({});
  const [globalReloadVersion, setGlobalReloadVersion] = useState(0);

  // Drag & Drop State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScreen, setEditingScreen] = useState<ProjectorScreenItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formWebLink, setFormWebLink] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<ProjectorScreenItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3400);
  }, []);

  // Load persisted local order overrides once on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setLocalOrders(loadLocalOrders());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Measure grid container dynamically via ResizeObserver (adapts to sidebar, resize, & fullscreen)
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      } else if (typeof window !== 'undefined') {
        setContainerSize({ width: window.innerWidth, height: window.innerHeight });
      }
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0) {
            setContainerSize({
              width,
              height: height > 0 ? height : window.innerHeight,
            });
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isLoading]);

  // Listen to native browser fullscreen changes (Esc key exit sync)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsGridFullscreen(active);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Escape fallback when in React fullscreen overlay without native fullscreen API
  useEffect(() => {
    if (!isGridFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        setIsGridFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isGridFullscreen]);

  // Fetch Screens + Realtime Sync
  const fetchScreens = useCallback(async (silent = false) => {
    try {
      if (silent || getCachedProjectorScreens() || screens.length > 0) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const { data, error } = await supabase
        .from('projector_screens')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        if (
          error.code === '42P01' ||
          /relation .*projector_screens.* does not exist/i.test(error.message || '') ||
          /schema cache/i.test(error.message || '')
        ) {
          setTableMissingNotice(true);
          setScreens([]);
          return;
        }
        throw error;
      }

      setTableMissingNotice(false);
      const rows = (data || []) as ProjectorScreenRow[];
      const mapped: ProjectorScreenItem[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        webLink: row.web_link,
        sortOrder: row.sort_order ?? 0,
        deviceOrders:
          row.device_orders && typeof row.device_orders === 'object' ? row.device_orders : {},
        isActive: row.is_active ?? true,
        createdBy: row.created_by || null,
        createdByName: row.created_by_name || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      setScreens(mapped);
      setCachedProjectorScreens(mapped as any);
    } catch (err: unknown) {
      console.warn('Error fetching projector screens:', getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void fetchScreens(false);
    }, 0);

    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
    const channelName = `screen-projector-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projector_screens' },
        () => {
          if (realtimeTimer) clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(() => {
            void fetchScreens(true);
          }, 250);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(initialTimer);
      if (realtimeTimer) clearTimeout(realtimeTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchScreens]);

  // Compute Auto-Grid Layout for current viewport & screen count
  const displayedCount = focusedScreenId ? 1 : screens.length;
  const autoGrid = useMemo(
    () =>
      computeAutoGrid(
        containerSize.width,
        containerSize.height,
        displayedCount,
        focusedScreenId ? '1x1' : gridPreset
      ),
    [containerSize.width, containerSize.height, displayedCount, focusedScreenId, gridPreset]
  );

  const activeProfileKey: LayoutProfileKey = autoGrid.profileKey;

  // Order screens for the active device profile (mobile / tablet / desktop / led_wall)
  const orderedScreens = useMemo(() => {
    const list = [...screens];
    const localIds = !canManage ? localOrders[activeProfileKey] : undefined;

    if (localIds && localIds.length > 0) {
      const rankMap = new Map(localIds.map((id, idx) => [id, idx]));
      return list.sort((a, b) => {
        const ra = rankMap.get(a.id);
        const rb = rankMap.get(b.id);
        if (ra !== undefined && rb !== undefined) return ra - rb;
        if (ra !== undefined) return -1;
        if (rb !== undefined) return 1;
        return a.sortOrder - b.sortOrder;
      });
    }

    return list.sort((a, b) => {
      const oa = a.deviceOrders?.[activeProfileKey];
      const ob = b.deviceOrders?.[activeProfileKey];
      if (typeof oa === 'number' && typeof ob === 'number') return oa - ob;
      if (typeof oa === 'number') return -1;
      if (typeof ob === 'number') return 1;
      return a.sortOrder - b.sortOrder;
    });
  }, [screens, activeProfileKey, canManage, localOrders]);

  const visibleScreens = useMemo(() => {
    if (!focusedScreenId) return orderedScreens;
    const focused = orderedScreens.find((s) => s.id === focusedScreenId);
    return focused ? [focused] : orderedScreens;
  }, [orderedScreens, focusedScreenId]);

  // Persist reordered layout per active device screen tier
  const commitReorder = useCallback(
    async (reordered: ProjectorScreenItem[]) => {
      const profileKey = activeProfileKey;

      if (!canManage) {
        // View-Only users can move layout locally on their device screen without DB mutation
        const updatedLocal: LocalOrderMap = {
          ...localOrders,
          [profileKey]: reordered.map((s) => s.id),
        };
        setLocalOrders(updatedLocal);
        saveLocalOrders(updatedLocal);
        return;
      }

      // Full Access: update optimistic state and persist device_orders + sort_order in Supabase
      const updatedScreens = reordered.map((item, idx) => ({
        ...item,
        sortOrder:
          profileKey === 'led_wall' || profileKey === 'desktop' ? idx + 1 : item.sortOrder,
        deviceOrders: {
          ...item.deviceOrders,
          [profileKey]: idx + 1,
        },
      }));

      setScreens(updatedScreens);

      try {
        await Promise.all(
          updatedScreens.map((item, idx) =>
            supabase
              .from('projector_screens')
              .update({
                device_orders: item.deviceOrders,
                ...(profileKey === 'led_wall' || profileKey === 'desktop'
                  ? { sort_order: idx + 1 }
                  : {}),
                updated_by: currentActorId,
              })
              .eq('id', item.id)
          )
        );
      } catch (err: unknown) {
        console.warn('Failed to persist screen layout order:', getErrorMessage(err));
        showToast('Could not save layout order.', 'error');
      }
    },
    [activeProfileKey, canManage, localOrders, currentActorId, showToast]
  );

  const handleMoveByOffset = useCallback(
    (screenId: string, delta: -1 | 1) => {
      const idx = orderedScreens.findIndex((s) => s.id === screenId);
      if (idx === -1) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= orderedScreens.length) return;

      const copy = [...orderedScreens];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      commitReorder(copy);
    },
    [orderedScreens, commitReorder]
  );

  const handleDropOnTile = useCallback(
    (targetId: string) => {
      if (!draggingId || draggingId === targetId) {
        setDraggingId(null);
        setDragOverId(null);
        return;
      }

      const fromIdx = orderedScreens.findIndex((s) => s.id === draggingId);
      const toIdx = orderedScreens.findIndex((s) => s.id === targetId);
      setDraggingId(null);
      setDragOverId(null);

      if (fromIdx === -1 || toIdx === -1) return;

      const copy = [...orderedScreens];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      commitReorder(copy);
    },
    [draggingId, orderedScreens, commitReorder]
  );

  // Fullscreen Grid-Only Toggle (strictly targets the grid container ref)
  const handleToggleGridFullscreen = useCallback(async () => {
    const el = gridContainerRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement && !isGridFullscreen) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
          setIsGridFullscreen(true);
        } else {
          setIsGridFullscreen(true);
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsGridFullscreen(false);
      }
    } catch {
      // Fallback to CSS fixed fullscreen if browser blocks native requestFullscreen
      setIsGridFullscreen((prev) => !prev);
    }
  }, [isGridFullscreen]);

  // Reload Controls
  const handleRefreshAll = () => {
    setGlobalReloadVersion((v) => v + 1);
    fetchScreens(true);
  };

  const handleRefreshOne = (id: string) => {
    setReloadKeys((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  // Modal Handlers (Full Access only)
  const handleOpenAddModal = () => {
    if (!canManage) return;
    setEditingScreen(null);
    setFormName('');
    setFormWebLink('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (screenItem: ProjectorScreenItem) => {
    if (!canManage) return;
    setEditingScreen(screenItem);
    setFormName(screenItem.name);
    setFormWebLink(screenItem.webLink);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    const trimmedName = formName.trim();
    const normalizedUrl = normalizeWebLink(formWebLink);

    if (!trimmedName) {
      setFormError('Screen Name is required.');
      return;
    }
    if (!isValidWebLink(normalizedUrl)) {
      setFormError('Please enter a valid web link (http:// or https://).');
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);

      if (editingScreen) {
        const { error } = await supabase
          .from('projector_screens')
          .update({
            name: trimmedName,
            web_link: normalizedUrl,
            updated_by: currentActorId,
          })
          .eq('id', editingScreen.id);

        if (error) throw error;

        if (currentActorId) {
          await supabase
            .from('audit_logs')
            .insert({
              user_id: currentActorId,
              action: 'UPDATE_PROJECTOR_SCREEN',
              entity_type: 'projector_screens',
              entity_id: editingScreen.id,
              details: { name: trimmedName, web_link: normalizedUrl },
            })
            .then(() => {});
        }

        showToast(`Updated "${trimmedName}".`);
      } else {
        const nextOrder =
          screens.length > 0 ? Math.max(...screens.map((s) => s.sortOrder || 0)) + 1 : 1;

        const { data: inserted, error } = await supabase
          .from('projector_screens')
          .insert({
            name: trimmedName,
            web_link: normalizedUrl,
            sort_order: nextOrder,
            device_orders: {
              mobile: nextOrder,
              tablet: nextOrder,
              desktop: nextOrder,
              led_wall: nextOrder,
            },
            is_active: true,
            created_by: currentActorId,
            created_by_name: currentActorName,
            updated_by: currentActorId,
          })
          .select()
          .maybeSingle();

        if (error) throw error;

        if (currentActorId) {
          await supabase
            .from('audit_logs')
            .insert({
              user_id: currentActorId,
              action: 'CREATE_PROJECTOR_SCREEN',
              entity_type: 'projector_screens',
              entity_id: inserted?.id || null,
              details: { name: trimmedName, web_link: normalizedUrl },
            })
            .then(() => {});
        }

        showToast(`Added "${trimmedName}" to Screen Projector.`);
      }

      setIsModalOpen(false);
      await fetchScreens(true);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'Failed to save projector screen.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canManage) return;
    try {
      setIsDeleting(true);
      const target = deleteTarget;

      const { error } = await supabase
        .from('projector_screens')
        .delete()
        .eq('id', target.id);

      if (error) throw error;

      if (currentActorId) {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: currentActorId,
            action: 'DELETE_PROJECTOR_SCREEN',
            entity_type: 'projector_screens',
            entity_id: target.id,
            details: { name: target.name, web_link: target.webLink },
          })
          .then(() => {});
      }

      if (focusedScreenId === target.id) {
        setFocusedScreenId(null);
      }

      setScreens((prev) => prev.filter((s) => s.id !== target.id));
      setDeleteTarget(null);
      showToast(`Removed "${target.name}".`);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to delete screen.'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasLocalViewOnlyOrder =
    !canManage && Boolean(localOrders[activeProfileKey]?.length);

  const handleResetLocalOrder = () => {
    const next = { ...localOrders };
    delete next[activeProfileKey];
    setLocalOrders(next);
    saveLocalOrders(next);
  };

  const layoutDropdownOptions = useMemo<CustomDropdownOption[]>(() => {
    const list: CustomDropdownOption[] = [
      {
        value: 'auto',
        label: 'Auto (Responsive)',
        description: 'Auto-calculates columns based on screen count & device size',
        badge: 'Default',
        badgeColor: 'bg-[#004AC6]/10 text-[#004AC6]',
      },
      {
        value: '1x1',
        label: '1×1 Single Screen',
        description: '1 column × 1 row (fills entire viewport)',
      },
      {
        value: '2x1',
        label: '2×1 Dual Split',
        description: '2 columns side-by-side',
      },
      {
        value: '2x2',
        label: '2×2 Quad Matrix',
        description: '4 screens in 2 columns × 2 rows',
      },
      {
        value: '3x2',
        label: '3×2 Video Wall',
        description: '6 screens in 3 columns × 2 rows',
      },
      {
        value: '4x2',
        label: '4×2 LED Wall',
        description: '8 screens in 4 columns × 2 rows',
      },
      {
        value: '3x3',
        label: '3×3 9-Screen',
        description: '9 screens in 3 columns × 3 rows',
      },
      {
        value: '4x3',
        label: '4×3 Command Wall',
        description: '12 screens in 4 columns × 3 rows',
      },
      {
        value: '5x3',
        label: '5×3 Wide Wall',
        description: '15 screens in 5 columns × 3 rows',
      },
      {
        value: '4x4',
        label: '4×4 16-Screen',
        description: '16 screens in 4 columns × 4 rows',
      },
      {
        value: '6x3',
        label: '6×3 Ultra-Wide',
        description: '18 screens in 6 columns × 3 rows',
      },
      {
        value: '6x4',
        label: '6×4 Ultra Wall',
        description: '24 screens in 6 columns × 4 rows',
      },
    ];

    if (focusedScreenId) {
      list.unshift({
        value: 'focused',
        label: 'Focused Screen (1×1)',
        description: 'Single tile focused — pick another layout to restore grid',
        badge: 'Active',
        badgeColor: 'bg-emerald-100 text-emerald-800',
      });
    }

    return list;
  }, [focusedScreenId]);

  return (
    <AppLayoutShell
      title="Screen Projector"
      subtitle="LED Wall Multi-Screen Grid"
      screen="Screen Projector"
      className="max-w-none px-2 sm:px-3 md:px-4 py-2 pb-2"
    >
      <div className="flex flex-col gap-2 w-full">
        {/* =================================================================== */}
        {/* 1. COMPACT ACTION TOOLBAR ONLY (NO BANNER, NO SUMMARY DATA) */}
        {/* =================================================================== */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          {/* Left: Layout Presets Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#505F76] hidden sm:inline">
              Layout:
            </span>
            <CustomDropdown
              size="sm"
              pill={false}
              value={focusedScreenId ? 'focused' : gridPreset}
              onChange={(val) => {
                setFocusedScreenId(null);
                if (val !== 'focused') {
                  setGridPreset(val as GridPreset);
                }
              }}
              options={layoutDropdownOptions}
              leftIcon={<LayoutGrid className="w-3.5 h-3.5 text-[#004AC6]" />}
              containerClassName="w-48 sm:w-56"
              className="py-1.5 px-2.5 text-xs rounded-lg border-[#E2E8F0] bg-white font-medium shadow-2xs hover:border-[#CBD5E1]"
              menuClassName="min-w-[260px] shadow-xl border border-[#E2E8F0] z-50 max-h-72"
            />
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-1.5 ml-auto">
            {hasLocalViewOnlyOrder && (
              <SecondaryButton
                type="button"
                size="sm"
                variant="outline"
                pill={false}
                onClick={handleResetLocalOrder}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                className="rounded-lg py-1.5 px-2.5"
                title="Reset local screen arrangement"
              >
                Reset Order
              </SecondaryButton>
            )}

            <SecondaryButton
              type="button"
              size="sm"
              variant="outline"
              pill={false}
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              leftIcon={
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              }
              className="rounded-lg py-1.5 px-2.5"
            >
              Refresh
            </SecondaryButton>

            <SecondaryButton
              type="button"
              size="sm"
              variant="outline"
              pill={false}
              onClick={handleToggleGridFullscreen}
              leftIcon={
                isGridFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )
              }
              className="rounded-lg py-1.5 px-2.5"
              title="Fullscreen Grid Layout Only"
            >
              Fullscreen Grid
            </SecondaryButton>

            {canManage && (
              <PrimaryButton
                type="button"
                size="sm"
                pill={false}
                onClick={handleOpenAddModal}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="rounded-lg py-1.5 px-3"
              >
                Add Screen
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* Missing Table Setup Helper (only visible if SQL migration wasn't run yet) */}
        {tableMissingNotice && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Database table <code className="font-mono font-bold">public.projector_screens</code> is not migrated yet. Execute{' '}
              <code className="font-mono font-bold">supabase/create_screen_projector_table.sql</code> in Supabase SQL Editor.
            </span>
          </div>
        )}

        {/* =================================================================== */}
        {/* 2. PROJECTOR SCREEN LAYOUTS GRID (FULLSCREEN TARGET CONTAINER) */}
        {/* =================================================================== */}
        <div
          ref={gridContainerRef}
          className={
            isGridFullscreen
              ? 'fixed inset-0 z-[999] w-screen h-screen bg-[#0B1120] p-1.5 overflow-auto group/fs'
              : `w-full relative ${
                  autoGrid.fillViewport
                    ? 'lg:h-[calc(100dvh-140px)] min-h-[420px]'
                    : 'min-h-[calc(100dvh-140px)]'
                }`
          }
        >
          {/* Auto-hiding Exit Fullscreen Pill (only visible on hover while in Fullscreen Grid mode) */}
          {isGridFullscreen && (
            <button
              type="button"
              onClick={handleToggleGridFullscreen}
              className="fixed top-2.5 right-2.5 z-[1010] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700/80 text-xs font-semibold shadow-xl opacity-0 hover:opacity-100 focus:opacity-100 group-hover/fs:opacity-75 transition-opacity cursor-pointer backdrop-blur-sm"
              title="Exit Fullscreen (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit Fullscreen</span>
            </button>
          )}

          {isLoading ? (
            <GridSkeleton />
          ) : visibleScreens.length === 0 ? (
            <div className="w-full h-full min-h-[380px] bg-white border border-dashed border-[#CBD5E1] rounded-2xl flex flex-col items-center justify-center p-8 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center">
                <Projector className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#1E293B]">
                No screens configured for projection yet.
              </p>
              {canManage && (
                <PrimaryButton
                  type="button"
                  size="sm"
                  pill={false}
                  onClick={handleOpenAddModal}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Add Screen
                </PrimaryButton>
              )}
            </div>
          ) : (
            <div
              className="grid gap-1.5 w-full h-full"
              style={{
                gridTemplateColumns: `repeat(${autoGrid.cols}, minmax(0, 1fr))`,
                ...(autoGrid.fillViewport
                  ? {
                      gridTemplateRows: `repeat(${autoGrid.rows}, minmax(0, 1fr))`,
                      height: '100%',
                    }
                  : {
                      gridAutoRows: `${autoGrid.minRowHeightPx}px`,
                    }),
              }}
            >
              {visibleScreens.map((screenItem, idx) => {
                const isDragging = draggingId === screenItem.id;
                const isDragOver = dragOverId === screenItem.id && draggingId !== screenItem.id;
                const isFocused = focusedScreenId === screenItem.id;
                const reloadCount = (reloadKeys[screenItem.id] || 0) + globalReloadVersion;
                const displayHost = getDisplayHost(screenItem.webLink);

                return (
                  <div
                    key={screenItem.id}
                    draggable={!focusedScreenId}
                    onDragStart={(e) => {
                      setDraggingId(screenItem.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', screenItem.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverId !== screenItem.id) {
                        setDragOverId(screenItem.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverId === screenItem.id) {
                        setDragOverId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropOnTile(screenItem.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                    className={`relative flex flex-col overflow-hidden rounded-xl border transition-all ${
                      isGridFullscreen
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-[#E2E8F0] shadow-2xs'
                    } ${isDragging ? 'opacity-50 scale-[0.99]' : ''} ${
                      isDragOver ? 'ring-2 ring-[#004AC6] border-[#004AC6]' : ''
                    }`}
                  >
                    {/* Compact 28px Tile Header */}
                    <div
                      title={`${screenItem.name} — ${screenItem.webLink}${
                        screenItem.createdByName ? ` (Created by ${screenItem.createdByName})` : ''
                      }`}
                      className={`h-7 px-2 border-b flex items-center justify-between gap-1.5 shrink-0 select-none ${
                        isGridFullscreen
                          ? 'bg-slate-950 border-slate-800 text-slate-100'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#1E293B]'
                      }`}
                    >
                      {/* Left: Drag Handle + Live Dot + Screen Name */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {!focusedScreenId && (
                          <span
                            className="cursor-grab active:cursor-grabbing text-[#94A3B8] hover:text-[#004AC6] shrink-0"
                            title="Drag to move screen"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-[11px] font-bold truncate">
                          {screenItem.name}
                        </span>
                        <span className="hidden xl:inline text-[10px] font-mono text-[#757680] truncate">
                          {displayHost}
                        </span>
                      </div>

                      {/* Right: Compact Micro Controls */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {!focusedScreenId && visibleScreens.length > 1 && (
                          <>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveByOffset(screenItem.id, -1)}
                              className="w-5 h-5 rounded flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-slate-200/60 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                              title="Move earlier"
                              aria-label="Move earlier"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === visibleScreens.length - 1}
                              onClick={() => handleMoveByOffset(screenItem.id, 1)}
                              className="w-5 h-5 rounded flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-slate-200/60 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                              title="Move later"
                              aria-label="Move later"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRefreshOne(screenItem.id)}
                          className="w-5 h-5 rounded flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-slate-200/60 cursor-pointer"
                          title="Reload screen"
                          aria-label="Reload screen"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setFocusedScreenId((prev) =>
                              prev === screenItem.id ? null : screenItem.id
                            )
                          }
                          className="w-5 h-5 rounded flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-slate-200/60 cursor-pointer"
                          title={isFocused ? 'Restore grid' : 'Focus screen'}
                          aria-label={isFocused ? 'Restore grid' : 'Focus screen'}
                        >
                          {isFocused ? (
                            <Minimize2 className="w-3 h-3" />
                          ) : (
                            <Maximize2 className="w-3 h-3" />
                          )}
                        </button>

                        <a
                          href={screenItem.webLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-5 h-5 rounded flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-slate-200/60 cursor-pointer"
                          title="Open in new tab"
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(screenItem)}
                              className="w-5 h-5 rounded flex items-center justify-center text-[#757680] hover:text-[#004AC6] hover:bg-slate-200/60 cursor-pointer"
                              title="Edit screen"
                              aria-label="Edit screen"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(screenItem)}
                              className="w-5 h-5 rounded flex items-center justify-center text-[#757680] hover:text-rose-600 hover:bg-rose-100/70 cursor-pointer"
                              title="Remove screen"
                              aria-label="Remove screen"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Live Embedded Webpage Viewport */}
                    <div className="relative flex-1 min-h-0 w-full bg-white">
                      <iframe
                        key={`${screenItem.id}-${reloadCount}`}
                        src={screenItem.webLink}
                        title={screenItem.name}
                        className="w-full h-full border-0 block"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        allow="fullscreen; autoplay"
                      />

                      {/* Drag-shield overlay prevents iframes from swallowing drag/drop events */}
                      {draggingId && (
                        <div className="absolute inset-0 z-20 bg-slate-900/5" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. ADD / EDIT SCREEN MODAL (FULL ACCESS ONLY) */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isModalOpen && canManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSaving && setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#004AC6]/10 text-[#004AC6] flex items-center justify-center">
                    <Projector className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-[#1E293B]">
                    {editingScreen ? 'Edit Screen' : 'Add Screen'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => !isSaving && setIsModalOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#757680] hover:text-[#1E293B] hover:bg-slate-200/60 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveScreen} className="p-5 space-y-4">
                {formError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Input 1: Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="projectorScreenName"
                    className="text-xs font-semibold text-[#505F76] uppercase tracking-wide block"
                  >
                    Name
                  </label>
                  <input
                    id="projectorScreenName"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Windy Cebu Weather Map"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  />
                </div>

                {/* Input 2: Web Link */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="projectorScreenUrl"
                    className="text-xs font-semibold text-[#505F76] uppercase tracking-wide block"
                  >
                    Web Link
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-[#757680] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="projectorScreenUrl"
                      type="text"
                      required
                      value={formWebLink}
                      onChange={(e) => setFormWebLink(e.target.value)}
                      placeholder="https://example.com/dashboard"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                    />
                  </div>
                </div>

                {/* Input 3: Created By User (auto-populated) */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#505F76] uppercase tracking-wide block">
                    Created By
                  </span>
                  <div className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#505F76] font-medium flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#004AC6] shrink-0" />
                    <span className="truncate font-semibold text-[#1E293B]">
                      {editingScreen?.createdByName || currentActorName}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <SecondaryButton
                    type="button"
                    size="sm"
                    pill={false}
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    type="submit"
                    size="sm"
                    pill={false}
                    disabled={isSaving}
                    leftIcon={
                      isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {isSaving ? 'Saving...' : editingScreen ? 'Save Changes' : 'Add Screen'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 4. DELETE CONFIRMATION MODAL */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {deleteTarget && canManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setDeleteTarget(null)}
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-sm bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Remove Screen</h3>
                  <p className="text-xs text-[#757680]">
                    Remove <strong className="text-[#1E293B]">{deleteTarget.name}</strong> from projector?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <SecondaryButton
                  type="button"
                  size="sm"
                  pill={false}
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </SecondaryButton>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* 5. TOAST NOTIFICATION */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-5 right-5 z-[1100] px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold text-white flex items-center gap-2 border ${
              toast.type === 'error'
                ? 'bg-rose-900 border-rose-700'
                : 'bg-[#1E293B] border-slate-700'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayoutShell>
  );
}
