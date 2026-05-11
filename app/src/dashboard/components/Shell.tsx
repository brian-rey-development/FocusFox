interface ShellProps {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  main: React.ReactNode;
}

export function Shell({ sidebar, topbar, main }: ShellProps) {
  return (
    <div className="dashboard-shell">
      {sidebar}
      <div className="dashboard-shell__right">
        {topbar}
        <main id="main-content" className="dashboard-shell__main">
          {main}
        </main>
      </div>
    </div>
  );
}
