import type { ReactNode } from 'react'
import {
  Box,
  Card,
  Heading,
  HStack,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'

export function ListInfoBar({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <HStack
      as="header"
      gap="4"
      justify="space-between"
      align="center"
      flexWrap="wrap"
    >
      <Box minW="0">
        <Heading as="h1" size="xl" letterSpacing="tight">
          {title}
        </Heading>
        {description ? (
          <Text fontSize="sm" color="fg.muted" mt="1">
            {description}
          </Text>
        ) : null}
      </Box>
      {children ? (
        <HStack gap="3" flexShrink={0} align="center">
          {children}
        </HStack>
      ) : null}
    </HStack>
  )
}

export function ListFilterBar({ children }: { children: ReactNode }) {
  return (
    <Card.Root as="section" aria-label="Filters" variant="outline" size="sm">
      <Card.Body py="3" px="4">
        {children}
      </Card.Body>
    </Card.Root>
  )
}

export function ListStatCards({
  items,
}: {
  items: { label: string; value: string; hint?: string }[]
}) {
  return (
    <SimpleGrid columns={{ base: 2, lg: 4 }} gap="3">
      {items.map((item) => (
        <Card.Root key={item.label} size="sm" variant="outline">
          <Card.Body gap="1" py="4" px="4">
            <Text fontSize="sm" color="fg.muted">
              {item.label}
            </Text>
            <Text
              fontSize="2xl"
              fontWeight="semibold"
              letterSpacing="tight"
              lineHeight="short"
            >
              {item.value}
            </Text>
            {item.hint ? (
              <Text fontSize="xs" color="fg.muted">
                {item.hint}
              </Text>
            ) : null}
          </Card.Body>
        </Card.Root>
      ))}
    </SimpleGrid>
  )
}
