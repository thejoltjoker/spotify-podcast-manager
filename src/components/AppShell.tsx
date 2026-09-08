import { useEffect, useState } from 'react'
import { Box, Button, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import { NavLink, Outlet } from 'react-router'
import type { IconType } from 'react-icons'
import {
  LuChevronsLeft,
  LuChevronsRight,
  LuHeadphones,
  LuLogOut,
  LuPodcast,
} from 'react-icons/lu'
import { useAuth } from '@/auth/AuthContext'
import { ColorModeButton } from '@/components/ui/color-mode'
import { Tooltip } from '@/components/ui/tooltip'

type NavItem = {
  to: string
  label: string
  icon: IconType
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Saved episodes', icon: LuHeadphones, end: true },
  { to: '/shows', label: 'Shows', icon: LuPodcast },
]

const COLLAPSED_KEY = 'nav_rail_collapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // ignore quota / private mode
    }
  }, [collapsed])

  const showLabels = !collapsed

  return (
    <HStack align="stretch" gap="0" minH="100dvh">
      <Box
        as="nav"
        position="sticky"
        top="0"
        h="100dvh"
        w={collapsed ? '16' : '60'}
        flexShrink={0}
        borderRightWidth="1px"
        bg="bg.panel"
        display="flex"
        flexDirection="column"
        py="4"
        px={collapsed ? '2' : '3'}
        transition="width 0.15s ease"
      >
        <HStack
          justify={collapsed ? 'center' : 'space-between'}
          align="start"
          mb="3"
          px={collapsed ? '0' : '1'}
        >
          {showLabels ? (
            <Box px="1" minW="0" flex="1">
              <Text fontWeight="semibold" fontSize="sm" lineClamp={1}>
                Podcast Manager
              </Text>
              <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                {user?.display_name ?? user?.id}
              </Text>
            </Box>
          ) : null}
          <Tooltip
            content={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            positioning={{ placement: 'right' }}
            openDelay={200}
          >
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <LuChevronsRight /> : <LuChevronsLeft />}
            </IconButton>
          </Tooltip>
        </HStack>

        <VStack align="stretch" gap="1" flex="1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <Tooltip
                key={item.to}
                content={item.label}
                positioning={{ placement: 'right' }}
                openDelay={200}
                disabled={showLabels}
              >
                <NavLink
                  to={item.to}
                  end={item.end}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  {({ isActive }) => (
                    <Button
                      variant={isActive ? 'subtle' : 'ghost'}
                      justifyContent={collapsed ? 'center' : 'flex-start'}
                      size="sm"
                      w="full"
                      px={collapsed ? '2' : '3'}
                    >
                      <Icon />
                      {showLabels ? <Text>{item.label}</Text> : null}
                    </Button>
                  )}
                </NavLink>
              </Tooltip>
            )
          })}
        </VStack>

        <VStack align="stretch" gap="1">
          <HStack justify={collapsed ? 'center' : 'flex-start'} px={collapsed ? '0' : '1'}>
            <ColorModeButton />
          </HStack>
          <Tooltip
            content="Log out"
            positioning={{ placement: 'right' }}
            openDelay={200}
            disabled={showLabels}
          >
            <Button
              variant="ghost"
              size="sm"
              justifyContent={collapsed ? 'center' : 'flex-start'}
              onClick={logout}
            >
              <LuLogOut />
              {showLabels ? <Text>Log out</Text> : null}
            </Button>
          </Tooltip>
        </VStack>
      </Box>

      <Box flex="1" minW="0" overflow="auto">
        <Outlet />
      </Box>
    </HStack>
  )
}
