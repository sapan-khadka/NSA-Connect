import {
  orderVisibleWidgetsForBriefing,
  type HomeWidgetId,
} from "../../lib/home-workspace";
import { HomeWidgetContent, type HomeWidgetData } from "./HomeWidgetContent";

type HomeBriefingLayoutProps = HomeWidgetData & {
  /** Visible workspace widgets (Edit dashboard show/hide). */
  visibleWidgetIds: HomeWidgetId[];
};

function briefingSectionClass(id: HomeWidgetId): string {
  if (id === "featured") {
    return "home-briefing__section home-briefing__section--hero";
  }
  if (
    id === "upcoming" ||
    id === "deadlines" ||
    id === "minutes" ||
    id === "actions" ||
    id === "pulse"
  ) {
    return "home-briefing__section home-briefing__section--plain";
  }
  return "home-briefing__section";
}

/**
 * Reading Home — flat document flow for board and members.
 * Photo event banner is the shared chapter highlight; Focus + work follow.
 */
export function HomeBriefingLayout({
  visibleWidgetIds,
  ...data
}: HomeBriefingLayoutProps) {
  const order = orderVisibleWidgetsForBriefing(visibleWidgetIds);
  const show = (id: HomeWidgetId) => order.includes(id);

  if (order.length === 0) {
    return (
      <div className="home-briefing">
        <p className="home-briefing__empty">
          No panels visible. Open Edit dashboard and show widgets to build your
          Home.
        </p>
      </div>
    );
  }

  const showTasks = show("tasks");
  const showActivity = show("activity");

  return (
    <div className="home-briefing">
      {show("featured") ? (
        <section className={briefingSectionClass("featured")}>
          <HomeWidgetContent id="featured" surface="briefing" data={data} />
        </section>
      ) : null}

      {show("overview") ? (
        <section className={briefingSectionClass("overview")}>
          <HomeWidgetContent id="overview" surface="briefing" data={data} />
        </section>
      ) : null}

      {showTasks || showActivity ? (
        <div
          className={[
            "home-briefing__split",
            showTasks && showActivity ? "" : "is-single",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showTasks ? (
            <section className="home-briefing__pane">
              <HomeWidgetContent id="tasks" surface="briefing" data={data} />
            </section>
          ) : null}

          {showActivity ? (
            <section className="home-briefing__pane">
              <HomeWidgetContent id="activity" surface="briefing" data={data} />
            </section>
          ) : null}
        </div>
      ) : null}

      {show("upcoming") ? (
        <section className={briefingSectionClass("upcoming")}>
          <HomeWidgetContent id="upcoming" surface="briefing" data={data} />
        </section>
      ) : null}

      {show("deadlines") ? (
        <section className={briefingSectionClass("deadlines")}>
          <HomeWidgetContent id="deadlines" surface="briefing" data={data} />
        </section>
      ) : null}

      {show("minutes") ? (
        <section className={briefingSectionClass("minutes")}>
          <HomeWidgetContent id="minutes" surface="briefing" data={data} />
        </section>
      ) : null}

      {show("actions") ? (
        <section className={briefingSectionClass("actions")}>
          <HomeWidgetContent id="actions" surface="briefing" data={data} />
        </section>
      ) : null}

      {show("pulse") ? (
        <section className={briefingSectionClass("pulse")}>
          <HomeWidgetContent id="pulse" surface="briefing" data={data} />
        </section>
      ) : null}
    </div>
  );
}
