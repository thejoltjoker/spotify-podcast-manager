import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionBar,
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Combobox,
  Dialog,
  HStack,
  IconButton,
  Image,
  Input,
  Link,
  Portal,
  Spinner,
  Table,
  Text,
  useFilter,
  useListCollection,
  VStack,
} from "@chakra-ui/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { LuCheckCheck, LuExternalLink, LuTrash2 } from "react-icons/lu";
import {
  PLAY_STATUS_LABELS,
  formatPlayProgress,
  playProgressRatio,
  type PlayStatus,
} from "@/lib/spotify/playStatus";
import type { EpisodeRow } from "@/lib/spotify/types";

const PLAY_STATUS_OPTIONS: { label: string; value: PlayStatus }[] = [
  { label: PLAY_STATUS_LABELS.unplayed, value: "unplayed" },
  { label: PLAY_STATUS_LABELS.in_progress, value: "in_progress" },
  { label: PLAY_STATUS_LABELS.finished, value: "finished" },
];

const PLAY_STATUS_COLORS: Record<PlayStatus, string> = {
  unplayed: "gray",
  in_progress: "orange",
  finished: "green",
};

const columnHelper = createColumnHelper<EpisodeRow>();

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTotalDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

type ConfirmKind = "remove" | "markPlayedAndRemove";

type ConfirmAction = {
  kind: ConfirmKind;
  rows: EpisodeRow[];
};

type EpisodeTableProps = {
  data: EpisodeRow[];
  loading: boolean;
  onRemove: (rows: EpisodeRow[]) => Promise<void>;
  onMarkPlayedAndRemove: (rows: EpisodeRow[]) => Promise<void>;
  removing: boolean;
};

function confirmCopy(action: ConfirmAction): {
  title: string;
  description: string;
  confirmLabel: string;
  colorPalette: "red" | "green";
} {
  const count = action.rows.length;
  const singleName = action.rows[0]?.name;

  if (action.kind === "markPlayedAndRemove") {
    return {
      title: "Mark as played and remove?",
      description:
        count === 1
          ? `Mark “${singleName}” as played and remove it from your Spotify library?`
          : `Mark ${count} episodes as played and remove them from your Spotify library?`,
      confirmLabel: "Mark played & remove",
      colorPalette: "green",
    };
  }

  return {
    title: "Remove from library?",
    description:
      count === 1
        ? `Remove “${singleName}” from your Spotify library?`
        : `Remove ${count} episodes from your Spotify library?`,
    confirmLabel: "Remove",
    colorPalette: "red",
  };
}

export function EpisodeTable({
  data,
  loading,
  onRemove,
  onMarkPlayedAndRemove,
  removing,
}: EpisodeTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "releaseDate", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedShows, setSelectedShows] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<PlayStatus[]>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null
  );

  const requestConfirm = useCallback(
    (kind: ConfirmKind, rows: EpisodeRow[]) => {
      if (rows.length === 0) return;
      setConfirmAction({ kind, rows });
    },
    []
  );

  const showItems = useMemo(() => {
    const names = [...new Set(data.map((row) => row.showName).filter(Boolean))];
    names.sort((a, b) => a.localeCompare(b));
    return names.map((name) => ({ label: name, value: name }));
  }, [data]);

  const { contains } = useFilter({ sensitivity: "base" });
  const {
    collection,
    filter,
    set: setShowCollection,
  } = useListCollection({
    initialItems: showItems,
    filter: contains,
  });
  const { collection: statusCollection, set: setStatusCollection } =
    useListCollection({
      initialItems: PLAY_STATUS_OPTIONS,
    });

  useEffect(() => {
    setShowCollection(showItems);
  }, [showItems, setShowCollection]);

  useEffect(() => {
    setStatusCollection(PLAY_STATUS_OPTIONS);
  }, [setStatusCollection]);

  useEffect(() => {
    const available = new Set(showItems.map((item) => item.value));
    setSelectedShows((prev) => {
      const next = prev.filter((show) => available.has(show));
      return next.length === prev.length ? prev : next;
    });
  }, [showItems]);

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    if (selectedShows.length > 0) {
      filters.push({ id: "showName", value: selectedShows });
    }
    if (selectedStatuses.length > 0) {
      filters.push({ id: "playStatus", value: selectedStatuses });
    }
    return filters;
  }, [selectedShows, selectedStatuses]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox.Root
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
            }
            onCheckedChange={(details) => {
              table.toggleAllPageRowsSelected(!!details.checked);
            }}
            aria-label="Select all on page"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Root>
        ),
        cell: ({ row }) => (
          <Checkbox.Root
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(details) => {
              row.toggleSelected(!!details.checked);
            }}
            aria-label={`Select ${row.original.name}`}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Root>
        ),
        size: 40,
      }),
      columnHelper.display({
        id: "artwork",
        header: "",
        cell: ({ row }) =>
          row.original.imageUrl ? (
            <Image
              src={row.original.imageUrl}
              alt=""
              boxSize="40px"
              rounded="sm"
              objectFit="cover"
            />
          ) : (
            <Box boxSize="40px" bg="bg.muted" rounded="sm" />
          ),
        size: 56,
      }),
      columnHelper.accessor("name", {
        header: "Episode",
        cell: (info) => (
          <Text fontWeight="medium" lineClamp={2}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("showName", {
        header: "Show",
        filterFn: (row, columnId, filterValue: string[]) => {
          if (!filterValue?.length) return true;
          return filterValue.includes(row.getValue(columnId));
        },
        cell: (info) => (
          <Text color="fg.muted" lineClamp={1}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("releaseDate", {
        header: "Released",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("durationMs", {
        header: "Duration",
        cell: (info) => formatDuration(info.getValue()),
      }),
      columnHelper.accessor("playStatus", {
        header: "Status",
        filterFn: (row, columnId, filterValue: PlayStatus[]) => {
          if (!filterValue?.length) return true;
          return filterValue.includes(row.getValue(columnId));
        },
        cell: (info) => {
          const status = info.getValue();
          return (
            <Badge
              colorPalette={PLAY_STATUS_COLORS[status]}
              size="sm"
              variant="subtle"
            >
              {PLAY_STATUS_LABELS[status]}
            </Badge>
          );
        },
      }),
      columnHelper.accessor(
        (row) =>
          playProgressRatio(
            row.playStatus,
            row.resumePositionMs,
            row.durationMs
          ),
        {
          id: "progress",
          header: "Progress",
          cell: ({ row }) => {
            const progress = formatPlayProgress(
              row.original.playStatus,
              row.original.resumePositionMs,
              row.original.durationMs
            );
            if (progress) {
              return (
                <Text fontSize="sm" whiteSpace="nowrap">
                  {progress}
                </Text>
              );
            }
            if (row.original.playStatus === "finished") {
              return (
                <Text fontSize="sm" color="fg.muted">
                  100%
                </Text>
              );
            }
            return (
              <Text fontSize="sm" color="fg.muted">
                —
              </Text>
            );
          },
        }
      ),
      columnHelper.display({
        id: "open",
        header: "",
        cell: ({ row }) => (
          <IconButton
            asChild
            size="sm"
            variant="ghost"
            aria-label="Open in Spotify"
          >
            <Link
              href={row.original.spotifyUrl}
              target="_blank"
              rel="noreferrer"
            >
              <LuExternalLink />
            </Link>
          </IconButton>
        ),
        size: 48,
      }),
      columnHelper.display({
        id: "markPlayedAndRemove",
        header: "",
        cell: ({ row }) => (
          <IconButton
            size="sm"
            variant="ghost"
            colorPalette="green"
            aria-label={`Mark “${row.original.name}” as played and remove`}
            title="Mark as played and remove"
            disabled={removing}
            onClick={() =>
              requestConfirm("markPlayedAndRemove", [row.original])
            }
          >
            <LuCheckCheck />
          </IconButton>
        ),
        size: 48,
      }),
      columnHelper.display({
        id: "remove",
        header: "",
        cell: ({ row }) => (
          <IconButton
            size="sm"
            variant="ghost"
            colorPalette="red"
            aria-label={`Remove ${row.original.name}`}
            title="Remove from library"
            disabled={removing}
            onClick={() => requestConfirm("remove", [row.original])}
          >
            <LuTrash2 />
          </IconButton>
        ),
        size: 48,
      }),
    ],
    [removing, requestConfirm]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) {
      table.setPageIndex(pageCount - 1);
    }
  }, [pageCount, pageIndex, table]);

  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);

  const filteredRows = table.getFilteredRowModel().rows;
  const filteredDurationMs = filteredRows.reduce(
    (sum, row) => sum + row.original.durationMs,
    0
  );

  async function handleConfirm() {
    if (!confirmAction) return;
    const { kind, rows } = confirmAction;
    if (kind === "markPlayedAndRemove") {
      await onMarkPlayedAndRemove(rows);
    } else {
      await onRemove(rows);
    }
    setConfirmAction(null);
    const removedIds = new Set(rows.map((row) => row.id));
    setRowSelection((prev) => {
      const next = { ...prev };
      for (const id of removedIds) delete next[id];
      return next;
    });
  }

  const dialog = confirmAction ? confirmCopy(confirmAction) : null;

  if (loading) {
    return (
      <VStack py="16" gap="3">
        <Spinner size="lg" />
        <Text color="fg.muted">Loading saved episodes…</Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap="4">
      <HStack gap="3" flexWrap="wrap" justify="space-between" align="start">
        <HStack gap="3" flexWrap="wrap" flex="1" minW="0">
          <Input
            maxW="sm"
            placeholder="Filter episodes…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          <Combobox.Root
            multiple
            closeOnSelect={false}
            width="xs"
            openOnClick
            collection={collection}
            value={selectedShows}
            onValueChange={(details) => setSelectedShows(details.value)}
            onInputValueChange={(details) => filter(details.inputValue)}
            placeholder="Filter by podcast…"
          >
            <Combobox.Control>
              <Combobox.Input />
              <Combobox.IndicatorGroup>
                <Combobox.ClearTrigger />
                <Combobox.Trigger />
              </Combobox.IndicatorGroup>
            </Combobox.Control>
            <Portal>
              <Combobox.Positioner>
                <Combobox.Content>
                  <Combobox.Empty>No podcasts found</Combobox.Empty>
                  {collection.items.map((item) => (
                    <Combobox.Item key={item.value} item={item}>
                      <Combobox.ItemText>{item.label}</Combobox.ItemText>
                      <Combobox.ItemIndicator />
                    </Combobox.Item>
                  ))}
                </Combobox.Content>
              </Combobox.Positioner>
            </Portal>
          </Combobox.Root>
          <Combobox.Root
            multiple
            closeOnSelect={false}
            width="2xs"
            openOnClick
            collection={statusCollection}
            value={selectedStatuses}
            onValueChange={(details) =>
              setSelectedStatuses(details.value as PlayStatus[])
            }
            placeholder="Filter by status…"
          >
            <Combobox.Control>
              <Combobox.Input />
              <Combobox.IndicatorGroup>
                <Combobox.ClearTrigger />
                <Combobox.Trigger />
              </Combobox.IndicatorGroup>
            </Combobox.Control>
            <Portal>
              <Combobox.Positioner>
                <Combobox.Content>
                  {statusCollection.items.map((item) => (
                    <Combobox.Item key={item.value} item={item}>
                      <Combobox.ItemText>{item.label}</Combobox.ItemText>
                      <Combobox.ItemIndicator />
                    </Combobox.Item>
                  ))}
                </Combobox.Content>
              </Combobox.Positioner>
            </Portal>
          </Combobox.Root>
        </HStack>
        <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
          {filteredRows.length} of {data.length} episodes ·{" "}
          {formatTotalDuration(filteredDurationMs)} total
        </Text>
      </HStack>
      {selectedShows.length > 0 || selectedStatuses.length > 0 ? (
        <HStack gap="2" flexWrap="wrap">
          {selectedShows.map((show) => (
            <Badge
              key={show}
              size="sm"
              colorPalette="green"
              variant="subtle"
              cursor="pointer"
              onClick={() =>
                setSelectedShows((prev) => prev.filter((s) => s !== show))
              }
              title="Remove filter"
            >
              {show} ×
            </Badge>
          ))}
          {selectedStatuses.map((status) => (
            <Badge
              key={status}
              size="sm"
              colorPalette={PLAY_STATUS_COLORS[status]}
              variant="subtle"
              cursor="pointer"
              onClick={() =>
                setSelectedStatuses((prev) => prev.filter((s) => s !== status))
              }
              title="Remove filter"
            >
              {PLAY_STATUS_LABELS[status]} ×
            </Badge>
          ))}
        </HStack>
      ) : null}

      {data.length === 0 ? (
        <Box py="12" textAlign="center">
          <Text color="fg.muted">
            No saved podcast episodes in your library.
          </Text>
        </Box>
      ) : (
        <>
          <Table.ScrollArea borderWidth="1px" rounded="md">
            <Table.Root size="sm" stickyHeader>
              <Table.Header>
                {table.getHeaderGroups().map((headerGroup) => (
                  <Table.Row key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      return (
                        <Table.ColumnHeader
                          key={header.id}
                          w={
                            header.getSize() !== 150
                              ? `${header.getSize()}px`
                              : undefined
                          }
                          cursor={canSort ? "pointer" : undefined}
                          userSelect={canSort ? "none" : undefined}
                          onClick={
                            canSort
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {{
                            asc: " ↑",
                            desc: " ↓",
                          }[header.column.getIsSorted() as string] ?? null}
                        </Table.ColumnHeader>
                      );
                    })}
                  </Table.Row>
                ))}
              </Table.Header>
              <Table.Body>
                {table.getRowModel().rows.map((row) => (
                  <Table.Row
                    key={row.id}
                    data-selected={row.getIsSelected() || undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <Table.Cell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>

          <HStack justify="space-between">
            <Text fontSize="sm" color="fg.muted">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </Text>
            <HStack>
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </HStack>
          </HStack>
        </>
      )}

      <ActionBar.Root
        open={selectedRows.length > 0}
        onOpenChange={(details) => {
          if (!details.open) setRowSelection({});
        }}
        closeOnInteractOutside={false}
      >
        <Portal>
          <ActionBar.Positioner>
            <ActionBar.Content>
              <ActionBar.SelectionTrigger>
                {selectedRows.length} selected
              </ActionBar.SelectionTrigger>
              <ActionBar.Separator />
              <Button
                size="sm"
                colorPalette="green"
                variant="outline"
                disabled={removing}
                onClick={() =>
                  requestConfirm("markPlayedAndRemove", selectedRows)
                }
              >
                <LuCheckCheck />
                Mark played & remove
              </Button>
              <Button
                size="sm"
                colorPalette="red"
                variant="outline"
                disabled={removing}
                onClick={() => requestConfirm("remove", selectedRows)}
              >
                <LuTrash2 />
                Remove
              </Button>
              <ActionBar.CloseTrigger asChild>
                <CloseButton size="sm" />
              </ActionBar.CloseTrigger>
            </ActionBar.Content>
          </ActionBar.Positioner>
        </Portal>
      </ActionBar.Root>

      <Dialog.Root
        role="alertdialog"
        placement="center"
        size="sm"
        lazyMount
        open={confirmAction !== null}
        onOpenChange={(details) => {
          if (!details.open) setConfirmAction(null);
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{dialog?.title}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>{dialog?.description}</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline" disabled={removing}>
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette={dialog?.colorPalette ?? "red"}
                  loading={removing}
                  onClick={() => void handleConfirm()}
                >
                  {dialog?.confirmLabel}
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
}
