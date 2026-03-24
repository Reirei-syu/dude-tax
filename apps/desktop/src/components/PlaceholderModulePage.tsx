type PlaceholderModulePageProps = {
  title: string;
  description: string;
};

export const PlaceholderModulePage = ({
  title,
  description,
}: PlaceholderModulePageProps) => (
  <section className="page-grid">
    <article className="page-section glass-card placeholder-card">
      <h1>{title}</h1>
      <p>{description}</p>
      <span className="tag">当前里程碑仅搭建导航与上下文主链路</span>
    </article>
  </section>
);

