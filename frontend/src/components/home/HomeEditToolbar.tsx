type HomeEditToolbarProps = {
  onAddWidget: () => void;
  onTidy?: () => void;
  onReset: () => void;
  onDone: () => void;
};

export function HomeEditToolbar({
  onAddWidget,
  onTidy,
  onReset,
  onDone,
}: HomeEditToolbarProps) {
  return (
    <div className="home-workspace-toolbar__edit-actions">
      <button
        type="button"
        className="home-workspace-toolbar__btn"
        onClick={onAddWidget}
      >
        + Widget
      </button>
      {onTidy ? (
        <button
          type="button"
          className="home-workspace-toolbar__btn"
          onClick={onTidy}
        >
          Tidy layout
        </button>
      ) : null}
      <button
        type="button"
        className="home-workspace-toolbar__btn"
        onClick={onReset}
      >
        Default layout
      </button>
      <button
        type="button"
        className="home-workspace-toolbar__btn is-active"
        onClick={onDone}
      >
        Done
      </button>
    </div>
  );
}
