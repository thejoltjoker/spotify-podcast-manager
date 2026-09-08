import { useEffect, useMemo, useState } from 'react'
import {
  ActionBar,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CloseButton,
  HStack,
  IconButton,
  Image,
  Link,
  Menu,
  Pagination,
  Portal,
  Spinner,
  Switch,
  Table,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import {
  LuBookmark,
  LuBookmarkMinus,
  LuChevronLeft,
  LuChevronRight,
  LuEllipsisVertical,
  LuExternalLink,
  LuListPlus,
  LuPlay,
} from 'react-icons/lu'
import { formatDuration, formatTotalDuration } from '@/lib/format'
import {
  PLAY_STATUS_LABELS,
  type PlayStatus,
} from '@/lib/spotify/playStatus'
import { isNewShowEpisode } from '@/lib/spotify/shows'
import type { ShowEpisodeRow } from '@/lib/spotify/types'
import { Tooltip } from '@/components/ui/tooltip'

const PREMIUM_HINT = 'Requires Spotify Premium'

const PLAY_STATUS_COLORS: Record<PlayStatus, string> = {
  unplayed: 'gray',
  in_progress: 'orange',
  finished: 'green',
}

const columnHelper = createColumnHelper<ShowEpisodeRow>()

type ShowEpisodeTableProps = {
  data: ShowEpisodeRow[]
  loading: boolean
  total: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onSave: (rows: ShowEpisodeRow[]) => Promise<void>
  onRemove: (rows: ShowEpisodeRow[]) => Promise<void>
  onPlay: (rows: ShowEpisodeRow[]) => Promise<void>
  onQueue: (rows: ShowEpisodeRow[]) => Promise<void>
  libraryBusy: boolean
  playbackBusy: boolean
  /** Player API requires Spotify Premium */
  playbackAllowed?: boolean
}

export function ShowEpisodeTable({
  data,
  loading,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
  onSave,
  onRemove,
  onPlay,
  onQueue,
  libraryBusy,
  playbackBusy,
  playbackAllowed = true,
}: ShowEpisodeTableProps) {
  const actionsDisabled = libraryBusy || playbackBusy
  const playbackDisabled = actionsDisabled || !playbackAllowed
  const playbackTitle = playbackAllowed ? undefined : PREMIUM_HINT
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'releaseDate', desc: true },
  ])
  const [onlyNew, setOnlyNew] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <Checkbox.Root
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(details) => {
              table.toggleAllPageRowsSelected(!!details.checked)
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
              row.toggleSelected(!!details.checked)
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
        id: 'artwork',
        header: '',
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
      columnHelper.accessor('name', {
        header: 'Episode',
        cell: (info) => (
          <Text fontWeight="medium" lineClamp={2}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor('releaseDate', {
        header: 'Released',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('durationMs', {
        header: 'Duration',
        cell: (info) => formatDuration(info.getValue()),
      }),
      columnHelper.accessor('playStatus', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue()
          return (
            <Badge
              colorPalette={PLAY_STATUS_COLORS[status]}
              size="sm"
              variant="subtle"
            >
              {PLAY_STATUS_LABELS[status]}
            </Badge>
          )
        },
      }),
      columnHelper.display({
        id: 'library',
        header: 'Library',
        cell: ({ row }) => {
          if (row.original.savedInLibrary) {
            return (
              <Text fontSize="sm" color="fg.muted">
                Saved
              </Text>
            )
          }
          if (isNewShowEpisode(row.original)) {
            return (
              <Badge colorPalette="green" size="sm" variant="solid">
                New
              </Badge>
            )
          }
          return (
            <Text fontSize="sm" color="fg.muted">
              Not saved
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const episode = row.original
          return (
            <>
              <HStack gap="0" display={{ base: 'none', xl: 'flex' }}>
                <IconButton
                  asChild
                  size="sm"
                  variant="ghost"
                  aria-label="Open in Spotify"
                >
                  <Link
                    href={episode.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <LuExternalLink />
                  </Link>
                </IconButton>
                <Tooltip content={PREMIUM_HINT} disabled={playbackAllowed}>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Play “${episode.name}”`}
                    title={playbackTitle ?? 'Play now'}
                    disabled={playbackDisabled}
                    onClick={() => void onPlay([episode])}
                  >
                    <LuPlay />
                  </IconButton>
                </Tooltip>
                <Tooltip content={PREMIUM_HINT} disabled={playbackAllowed}>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Add “${episode.name}” to queue`}
                    title={playbackTitle ?? 'Add to queue'}
                    disabled={playbackDisabled}
                    onClick={() => void onQueue([episode])}
                  >
                    <LuListPlus />
                  </IconButton>
                </Tooltip>
                {episode.savedInLibrary ? (
                  <IconButton
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    aria-label={`Remove “${episode.name}” from library`}
                    title="Remove from library"
                    disabled={actionsDisabled}
                    onClick={() => void onRemove([episode])}
                  >
                    <LuBookmarkMinus />
                  </IconButton>
                ) : (
                  <IconButton
                    size="sm"
                    variant="ghost"
                    colorPalette="green"
                    aria-label={`Save “${episode.name}” to library`}
                    title="Save to library"
                    disabled={actionsDisabled}
                    onClick={() => void onSave([episode])}
                  >
                    <LuBookmark />
                  </IconButton>
                )}
              </HStack>

              <Box display={{ base: 'block', xl: 'none' }}>
                <Menu.Root positioning={{ placement: 'bottom-end' }}>
                  <Menu.Trigger asChild>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Actions for “${episode.name}”`}
                    >
                      <LuEllipsisVertical />
                    </IconButton>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="open" asChild>
                          <Link
                            href={episode.spotifyUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <LuExternalLink />
                            Open in Spotify
                          </Link>
                        </Menu.Item>
                        <Menu.Item
                          value="play"
                          disabled={playbackDisabled}
                          onSelect={() => void onPlay([episode])}
                          title={playbackTitle}
                        >
                          <LuPlay />
                          Play now
                        </Menu.Item>
                        <Menu.Item
                          value="queue"
                          disabled={playbackDisabled}
                          onSelect={() => void onQueue([episode])}
                          title={playbackTitle}
                        >
                          <LuListPlus />
                          Add to queue
                        </Menu.Item>
                        <Menu.Separator />
                        {episode.savedInLibrary ? (
                          <Menu.Item
                            value="remove"
                            color="fg.error"
                            disabled={actionsDisabled}
                            onSelect={() => void onRemove([episode])}
                          >
                            <LuBookmarkMinus />
                            Remove from library
                          </Menu.Item>
                        ) : (
                          <Menu.Item
                            value="save"
                            color="fg.success"
                            disabled={actionsDisabled}
                            onSelect={() => void onSave([episode])}
                          >
                            <LuBookmark />
                            Save to library
                          </Menu.Item>
                        )}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </Box>
            </>
          )
        },
      }),
    ],
    [actionsDisabled, playbackAllowed, playbackDisabled, playbackTitle, onPlay, onQueue, onRemove, onSave],
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      globalFilter: onlyNew ? true : undefined,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      if (!filterValue) return true
      return isNewShowEpisode(row.original)
    },
    initialState: {
      pagination: { pageSize: 25 },
    },
  })

  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) {
      table.setPageIndex(pageCount - 1)
    }
  }, [pageCount, pageIndex, table])

  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)
  const filteredRows = table.getFilteredRowModel().rows
  const filteredDurationMs = filteredRows.reduce(
    (sum, row) => sum + row.original.durationMs,
    0,
  )
  const newCount = data.filter((row) => isNewShowEpisode(row)).length
  const selectedNew = selectedRows.filter((row) => isNewShowEpisode(row))
  const selectedSaved = selectedRows.filter((row) => row.savedInLibrary)

  if (loading) {
    return (
      <VStack py="16" gap="3">
        <Spinner size="lg" />
        <Text color="fg.muted">Loading episodes…</Text>
      </VStack>
    )
  }

  return (
    <VStack align="stretch" gap="4">
      <HStack justify="space-between" flexWrap="wrap" gap="3">
        <Switch.Root
          checked={onlyNew}
          onCheckedChange={(details) => setOnlyNew(!!details.checked)}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label>Only new episodes</Switch.Label>
        </Switch.Root>
        <HStack gap="3">
          <Button
            size="sm"
            colorPalette="green"
            variant="outline"
            disabled={actionsDisabled || newCount === 0}
            onClick={() =>
              void onSave(data.filter((row) => isNewShowEpisode(row)))
            }
          >
            <LuBookmark />
            Save all new
          </Button>
          <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
            {newCount} new of {data.length} loaded
            {total > data.length ? ` · ${total} total` : ''} ·{' '}
            {formatTotalDuration(filteredDurationMs)}
          </Text>
        </HStack>
      </HStack>

      {data.length === 0 ? (
        <Box py="12" textAlign="center">
          <Text color="fg.muted">No episodes found for this show.</Text>
        </Box>
      ) : (
        <>
          <Table.ScrollArea borderWidth="1px" rounded="md">
            <Table.Root size="sm" stickyHeader>
              <Table.Header>
                {table.getHeaderGroups().map((headerGroup) => (
                  <Table.Row key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort()
                      return (
                        <Table.ColumnHeader
                          key={header.id}
                          w={
                            header.getSize() !== 150
                              ? `${header.getSize()}px`
                              : undefined
                          }
                          cursor={canSort ? 'pointer' : undefined}
                          userSelect={canSort ? 'none' : undefined}
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
                                header.getContext(),
                              )}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </Table.ColumnHeader>
                      )
                    })}
                  </Table.Row>
                ))}
              </Table.Header>
              <Table.Body>
                {table.getRowModel().rows.map((row) => (
                  <Table.Row
                    key={row.id}
                    data-selected={row.getIsSelected() || undefined}
                    bg={
                      isNewShowEpisode(row.original) ? 'bg.info' : undefined
                    }
                    borderLeftWidth={
                      isNewShowEpisode(row.original) ? '3px' : undefined
                    }
                    borderLeftColor={
                      isNewShowEpisode(row.original)
                        ? 'green.solid'
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <Table.Cell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>

          <HStack justify="space-between" flexWrap="wrap" gap="3">
            {hasMore ? (
              <Button
                size="sm"
                variant="outline"
                loading={loadingMore}
                onClick={onLoadMore}
              >
                Load more
              </Button>
            ) : (
              <Box />
            )}
            <Pagination.Root
              count={filteredRows.length}
              pageSize={table.getState().pagination.pageSize}
              page={pageIndex + 1}
              onPageChange={(details) => {
                table.setPageIndex(details.page - 1)
              }}
            >
              <ButtonGroup variant="ghost" size="sm">
                <Pagination.PrevTrigger asChild>
                  <IconButton aria-label="Previous page">
                    <LuChevronLeft />
                  </IconButton>
                </Pagination.PrevTrigger>
                <Pagination.Items
                  render={(page) => (
                    <IconButton
                      variant={{ base: 'ghost', _selected: 'outline' }}
                    >
                      {page.value}
                    </IconButton>
                  )}
                />
                <Pagination.NextTrigger asChild>
                  <IconButton aria-label="Next page">
                    <LuChevronRight />
                  </IconButton>
                </Pagination.NextTrigger>
              </ButtonGroup>
            </Pagination.Root>
          </HStack>
        </>
      )}

      <ActionBar.Root
        open={selectedRows.length > 0}
        onOpenChange={(details) => {
          if (!details.open) setRowSelection({})
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
              <Tooltip content={PREMIUM_HINT} disabled={playbackAllowed}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={playbackDisabled}
                  loading={playbackBusy}
                  title={playbackTitle}
                  onClick={() => void onPlay(selectedRows)}
                >
                  <LuPlay />
                  Play
                </Button>
              </Tooltip>
              <Tooltip content={PREMIUM_HINT} disabled={playbackAllowed}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={playbackDisabled}
                  loading={playbackBusy}
                  title={playbackTitle}
                  onClick={() => void onQueue(selectedRows)}
                >
                  <LuListPlus />
                  Add to queue
                </Button>
              </Tooltip>
              {selectedNew.length > 0 ? (
                <Button
                  size="sm"
                  colorPalette="green"
                  variant="outline"
                  disabled={actionsDisabled}
                  onClick={() => void onSave(selectedNew)}
                >
                  <LuBookmark />
                  Save selected
                </Button>
              ) : null}
              {selectedSaved.length > 0 ? (
                <Button
                  size="sm"
                  colorPalette="red"
                  variant="outline"
                  disabled={actionsDisabled}
                  onClick={() => void onRemove(selectedSaved)}
                >
                  <LuBookmarkMinus />
                  Remove selected
                </Button>
              ) : null}
              <ActionBar.CloseTrigger asChild>
                <CloseButton size="sm" />
              </ActionBar.CloseTrigger>
            </ActionBar.Content>
          </ActionBar.Positioner>
        </Portal>
      </ActionBar.Root>
    </VStack>
  )
}
