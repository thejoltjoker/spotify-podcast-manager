import { useEffect, useMemo, useState } from 'react'
import {
  ActionBar,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CloseButton,
  Combobox,
  Dialog,
  HStack,
  IconButton,
  Image,
  Input,
  Link,
  Menu,
  Pagination,
  Portal,
  Table,
  Text,
  VStack,
  useFilter,
  useListCollection,
} from '@chakra-ui/react'
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
} from '@tanstack/react-table'
import { NavLink } from 'react-router'
import {
  LuChevronLeft,
  LuChevronRight,
  LuEllipsisVertical,
  LuExternalLink,
  LuUserMinus,
} from 'react-icons/lu'
import type { ShowRow } from '@/lib/spotify/types'

const columnHelper = createColumnHelper<ShowRow>()

function formatFollowedDate(iso: string): string {
  if (!iso) return '—'
  const date = iso.slice(0, 10)
  return date || iso
}

type ShowTableProps = {
  data: ShowRow[]
  onUnfollow: (rows: ShowRow[]) => Promise<void>
  unfollowing: boolean
}

export function ShowTable({ data, onUnfollow, unfollowing }: ShowTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'addedAt', desc: true },
  ])
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmRows, setConfirmRows] = useState<ShowRow[] | null>(null)

  const publisherItems = useMemo(() => {
    const names = [
      ...new Set(data.map((row) => row.publisher).filter(Boolean)),
    ]
    names.sort((a, b) => a.localeCompare(b))
    return names.map((name) => ({ label: name, value: name }))
  }, [data])

  const { contains } = useFilter({ sensitivity: 'base' })
  const {
    collection,
    filter,
    set: setPublisherCollection,
  } = useListCollection({
    initialItems: publisherItems,
    filter: contains,
  })

  useEffect(() => {
    setPublisherCollection(publisherItems)
  }, [publisherItems, setPublisherCollection])

  useEffect(() => {
    const available = new Set(publisherItems.map((item) => item.value))
    setSelectedPublishers((prev) => {
      const next = prev.filter((publisher) => available.has(publisher))
      return next.length === prev.length ? prev : next
    })
  }, [publisherItems])

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = []
    if (selectedPublishers.length > 0) {
      filters.push({ id: 'publisher', value: selectedPublishers })
    }
    return filters
  }, [selectedPublishers])

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
        header: 'Show',
        cell: ({ row }) => (
          <VStack align="start" gap="0" minW="0">
            <Link asChild color="fg" fontWeight="medium" lineClamp={1}>
              <NavLink to={`/shows/${row.original.id}`}>
                {row.original.name}
              </NavLink>
            </Link>
            <Text fontSize="sm" color="fg.muted" lineClamp={1}>
              {row.original.publisher}
            </Text>
          </VStack>
        ),
      }),
      columnHelper.accessor('publisher', {
        header: 'Publisher',
        filterFn: (row, columnId, filterValue: string[]) => {
          if (!filterValue?.length) return true
          return filterValue.includes(row.getValue(columnId))
        },
        cell: (info) => (
          <Text color="fg.muted" lineClamp={1}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor('totalEpisodes', {
        header: 'Episodes',
        cell: (info) => {
          const value = info.getValue()
          return value == null ? '—' : String(value)
        },
      }),
      columnHelper.accessor('addedAt', {
        header: 'Followed',
        cell: (info) => formatFollowedDate(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const show = row.original
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
                    href={show.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <LuExternalLink />
                  </Link>
                </IconButton>
                <IconButton
                  size="sm"
                  variant="ghost"
                  colorPalette="red"
                  aria-label={`Unfollow “${show.name}”`}
                  title="Unfollow show"
                  disabled={unfollowing}
                  onClick={() => setConfirmRows([show])}
                >
                  <LuUserMinus />
                </IconButton>
              </HStack>

              <Box display={{ base: 'block', xl: 'none' }}>
                <Menu.Root positioning={{ placement: 'bottom-end' }}>
                  <Menu.Trigger asChild>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Actions for “${show.name}”`}
                    >
                      <LuEllipsisVertical />
                    </IconButton>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="open" asChild>
                          <Link
                            href={show.spotifyUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <LuExternalLink />
                            Open in Spotify
                          </Link>
                        </Menu.Item>
                        <Menu.Item
                          value="unfollow"
                          color="fg.error"
                          disabled={unfollowing}
                          onSelect={() => setConfirmRows([show])}
                        >
                          <LuUserMinus />
                          Unfollow
                        </Menu.Item>
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
    [unfollowing],
  )

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
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.trim().toLowerCase()
      if (!q) return true
      return (
        row.original.name.toLowerCase().includes(q) ||
        row.original.publisher.toLowerCase().includes(q)
      )
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

  async function handleConfirmUnfollow() {
    if (!confirmRows?.length) return
    const rows = confirmRows
    await onUnfollow(rows)
    setConfirmRows(null)
    const removedIds = new Set(rows.map((row) => row.id))
    setRowSelection((prev) => {
      const next = { ...prev }
      for (const id of removedIds) delete next[id]
      return next
    })
  }

  const confirmCount = confirmRows?.length ?? 0
  const confirmName = confirmRows?.[0]?.name

  return (
    <VStack align="stretch" gap="4">
      <HStack gap="3" w="full" flexWrap="wrap">
        <Input
          flex="1"
          minW="2xs"
          placeholder="Filter shows…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
        <Combobox.Root
          multiple
          closeOnSelect={false}
          flex="1"
          minW="2xs"
          width="full"
          openOnClick
          collection={collection}
          value={selectedPublishers}
          onValueChange={(details) => setSelectedPublishers(details.value)}
          onInputValueChange={(details) => filter(details.inputValue)}
          placeholder="Filter by publisher…"
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
                <Combobox.Empty>No publishers found</Combobox.Empty>
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
      </HStack>

      <Text
        fontSize="sm"
        color="fg.muted"
        whiteSpace="nowrap"
        alignSelf="flex-end"
      >
        {filteredRows.length} of {data.length} shows
      </Text>

      {selectedPublishers.length > 0 ? (
        <HStack gap="2" flexWrap="wrap">
          {selectedPublishers.map((publisher) => (
            <Badge
              key={publisher}
              size="sm"
              colorPalette="green"
              variant="subtle"
              cursor="pointer"
              onClick={() =>
                setSelectedPublishers((prev) =>
                  prev.filter((p) => p !== publisher),
                )
              }
              title="Remove filter"
            >
              {publisher} ×
            </Badge>
          ))}
        </HStack>
      ) : null}

      {data.length === 0 ? (
        <Box py="12" textAlign="center">
          <Text color="fg.muted">
            You are not following any podcast shows yet.
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

          <HStack justify="flex-end">
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
              <Button
                size="sm"
                colorPalette="red"
                variant="outline"
                disabled={unfollowing}
                onClick={() => setConfirmRows(selectedRows)}
              >
                <LuUserMinus />
                Unfollow
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
        open={confirmRows !== null}
        onOpenChange={(details) => {
          if (!details.open) setConfirmRows(null)
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Unfollow show?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  {confirmCount === 1
                    ? `Unfollow “${confirmName}”? You can follow it again later from Spotify.`
                    : `Unfollow ${confirmCount} shows? You can follow them again later from Spotify.`}
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline" disabled={unfollowing}>
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  loading={unfollowing}
                  disabled={unfollowing}
                  onClick={() => void handleConfirmUnfollow()}
                >
                  Unfollow
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
  )
}
