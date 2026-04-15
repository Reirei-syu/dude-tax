import { type ReactNode, useId } from "react";
import { useWorkspaceCollapseState } from "./WorkspaceLayout";

type Props = {
  cardId?: string;
  title: string;
  description?: string;
  defaultCollapsed?: boolean;
  headerExtras?: ReactNode;
  className?: string;
  headingTag?: "h1" | "h2" | "h3";
  children?: ReactNode;
};

export const CollapsibleSectionCard = ({
  cardId,
  title,
  description,
  defaultCollapsed = false,
  headerExtras,
  className,
  headingTag = "h2",
  children,
}: Props) => {
  const { isCollapsed, toggleCollapsed } = useWorkspaceCollapseState(cardId ?? null, defaultCollapsed);
  const contentId = useId();
  const HeadingTag = headingTag;

  return (
    <article
      className={["glass-card", "page-section", className].filter(Boolean).join(" ")}
      data-card-id={cardId}
    >
      <div className="section-header" data-workspace-drag-handle="true">
        <div>
          <HeadingTag>{title}</HeadingTag>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="section-header-actions">
          {headerExtras}
          <button
            aria-controls={contentId}
            aria-expanded={!isCollapsed}
            className="ghost-button"
            type="button"
            onClick={toggleCollapsed}
          >
            {isCollapsed ? "展开" : "折叠"}
          </button>
        </div>
      </div>

      <div className="collapsible-card-body" hidden={isCollapsed} id={contentId}>
        {children}
      </div>
    </article>
  );
};
