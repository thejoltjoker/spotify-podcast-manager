import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ActionBar,
  Box,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  CloseButton,
  Dialog,
  HStack,
  IconButton,
  Image,
  Input,
  InputGroup,
  Link,
  Menu,
  NativeSelect,
  Pagination,
  Portal,
  Spinner,
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
import { NavLink } from 'react-router'
import {
  LuAppWindow,
  LuChevronLeft,
  LuChevronRight,
  LuEllipsisVertical,
  LuExternalLink,
  LuSearch,
  LuUserMinus,
} from 'react-icons/lu'
import {
  ListFilterBar,
  ListInfoBar,
  ListStatCards,
} from '@/components/ListChrome'
import type { ShowRow } from '@/lib/spotify/types'
import { Tooltip } from '@/components/ui/tooltip'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

const columnHelper = createColumnHelper<ShowRow>()

function formatFollowedDate(iso: string): string {
  if (!iso) return '—'
  const date = iso.slice(0, 10)
  return date || iso
}

type ShowTableProps = {
  data: ShowRow[]
  loading: boolean
  title: string
  description?: string
  headerActions?: ReactNode
  onUnfollow: (rows: ShowRow[]) => Promise<void>
  unfollowing: boolean
}

export function ShowTable({
  data,
  loading,
  title,
  description,
  headerActions,
  onUnfollow,
  unfollowing,
}: ShowTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'addedAt', desc: true },
  ])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [confirmRows, setConfirmRows] = useState<ShowRow[] | null>(null)

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
          <Link asChild color="fg" fontWeight="medium" lineClamp={1}>
            <NavLink to={`/shows/${row.original.id}`}>
              {row.original.name}
            </NavLink>
          </Link>
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
                <Tooltip content="Open in Spotify app">
                  <IconButton
                    asChild
                    size="sm"
                    variant="ghost"
                    aria-label="Open in Spotify app"
                  >
                    <Link href={show.uri}>
                      <LuAppWindow />
                    </Link>
                  </IconButton>
                </Tooltip>
                <Tooltip content="Open in browser">
                  <IconButton
                    asChild
                    size="sm"
                    variant="ghost"
                    aria-label="Open in browser"
                  >
                    <Link
                      href={show.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <LuExternalLink />
                    </Link>
                  </IconButton>
                </Tooltip>
                <Tooltip content="Unfollow show">
                  <IconButton
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    aria-label={`Unfollow “${show.name}”`}
                    disabled={unfollowing}
                    onClick={() => setConfirmRows([show])}
                  >
                    <LuUserMinus />
                  </IconButton>
                </Tooltip>
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
                        <Menu.Item value="open-app" asChild>
                          <Link href={show.uri}>
                            <LuAppWindow />
                            Open in Spotify app
                          </Link>
                        </Menu.Item>
                        <Menu.Item value="open-web" asChild>
                          <Link
                            href={show.spotifyUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <LuExternalLink />
                            Open in browser
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
    state: {
      sorting,
      globalFilter,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: (updater) => {
      setGlobalFilter((prev) =>
        typeof updater === 'function' ? updater(prev) : updater,
      )
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    },
    onPaginationChange: setPagination,
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
      return row.original.name.toLowerCase().includes(q)
    },
  })

  const pageCount = table.getPageCount()
  const pageIndex = pagination.pageIndex
  const pageSize = pagination.pageSize
  useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) {
      setPagination((prev) => ({ ...prev, pageIndex: pageCount - 1 }))
    }
  }, [pageCount, pageIndex])

  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)
  const filteredRows = table.getFilteredRowModel().rows
  const catalogEpisodes = filteredRows.reduce(
    (sum, row) => sum + (row.original.totalEpisodes ?? 0),
    0,
  )
  const showsWithCounts = filteredRows.filter(
    (row) => row.original.totalEpisodes != null,
  ).length
  const avgEpisodes =
    showsWithCounts > 0
      ? Math.round(catalogEpisodes / showsWithCounts)
      : null

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
  const stats = [
    {
      label: 'Shows',
      value: String(filteredRows.length),
      hint:
        filteredRows.length === data.length
          ? 'You follow'
          : `of ${data.length} followed`,
    },
    {
      label: 'Catalog episodes',
      value: String(catalogEpisodes),
      hint: 'Listed on Spotify',
    },
    {
      label: 'Avg. episodes',
      value: avgEpisodes == null ? '—' : String(avgEpisodes),
      hint: 'Per show with a count',
    },
  ]

  return (
    <VStack align="stretch" gap="4">
      <ListInfoBar title={title} description={description}>
        {headerActions}
      </ListInfoBar>
      {loading ? null : (
        <ListFilterBar>
          <InputGroup
            startElement={<LuSearch />}
            flex="1"
            minW="200px"
            maxW="sm"
          >
            <Input
              size="sm"
              type="search"
              aria-label="Filter shows"
              placeholder="Filter shows…"
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
            />
          </InputGroup>
        </ListFilterBar>
      )}
      {loading ? null : <ListStatCards items={stats} />}

      {loading ? (
        <VStack py="16" gap="3">
          <Spinner size="lg" />
          <Text color="fg.muted">Loading followed shows…</Text>
        </VStack>
      ) : data.length === 0 ? (
        <Card.Root variant="outline">
          <Card.Body py="12" textAlign="center">
            <Text color="fg.muted">
              You are not following any podcast shows yet.
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Card.Root variant="outline" overflow="hidden">
          <Table.ScrollArea>
            <Table.Root size="sm" stickyHeader>
              <Table.Header>
                {table.getHeaderGroups().map((headerGroup) => (
                  <Table.Row key={headerGroup.id} bg="bg.subtle">
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
                    _selected={{
                      bg: 'orange.subtle',
                      boxShadow: 'inset 3px 0 0 {colors.orange.solid}',
                    }}
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

          <HStack
            justify="space-between"
            flexWrap="wrap"
            gap="3"
            px="4"
            py="3"
            borderTopWidth="1px"
          >
            <HStack gap="2">
              <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
                Per page
              </Text>
              <NativeSelect.Root size="sm" width="20">
                <NativeSelect.Field
                  aria-label="Rows per page"
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPagination({
                      pageIndex: 0,
                      pageSize: Number(e.target.value),
                    })
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </HStack>
            <Pagination.Root
              count={filteredRows.length}
              pageSize={pageSize}
              page={pageIndex + 1}
              onPageChange={(details) => {
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: details.page - 1,
                }))
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
        </Card.Root>
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
