import { Anchor, Group } from "@mantine/core";
import type { GuideSection } from "@mensal/guide";
import { IconBook } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * The static guide's address (PRD §7.17), or one of its sections. The guide
 * is not part of the app: links to it are full navigations, never client
 * routes, and the section is one of the guide's own exported ids.
 */
export function guideHref(section?: GuideSection) {
  return section === undefined ? "/guia/" : `/guia/#${section}`;
}

/** A plain link into the guide, opening in the same tab. */
export function GuideLink({
  section,
  children,
}: {
  section?: GuideSection;
  children: ReactNode;
}) {
  return (
    <Anchor href={guideHref(section)} fz="sm">
      <Group component="span" gap={6} display="inline-flex" wrap="nowrap">
        <IconBook size={18} aria-hidden="true" />
        {children}
      </Group>
    </Anchor>
  );
}
