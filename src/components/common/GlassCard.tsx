import type { ReactNode } from 'react';

interface GlassCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
  /** 填满可缩放节点：高度 100% + 内部滚动 */
  fill?: boolean;
}

/**
 * 功能面板卡片（现代 SaaS 实心白卡，非毛玻璃）
 * 保留组件名以兼容既有引用。
 */
export function GlassCard({
  title,
  subtitle,
  children,
  className = '',
  headerRight,
  fill = false,
}: GlassCardProps) {
  return (
    <div
      className={`panel relative p-4 ${
        fill ? 'flex h-full w-full flex-col overflow-hidden' : ''
      } ${className}`}
    >
      {(title || headerRight) && (
        <div className={`panel-header ${fill ? 'shrink-0' : ''}`}>
          <div className="min-w-0">
            {title && <h3 className="panel-title truncate">{title}</h3>}
            {subtitle && <p className="panel-subtitle truncate">{subtitle}</p>}
          </div>
          {headerRight}
        </div>
      )}
      <div className={fill ? 'min-h-0 flex-1 overflow-auto' : undefined}>
        {children}
      </div>
    </div>
  );
}
