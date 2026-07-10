import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CalendarCard,
  ChartContainer,
  DataTable,
  EmptyState,
  MetricCard,
  Timeline,
} from "../index";

describe("design-system data-display components", () => {
  it("renders DataTable rows and empty state", () => {
    const { rerender } = render(
      <DataTable
        columns={[
          { id: "name", header: "Name", cell: (row: { name: string }) => row.name },
          {
            id: "amount",
            header: "Amount",
            align: "right",
            cell: (row: { amount: string }) => row.amount,
          },
        ]}
        rows={[
          { id: "1", name: "Dues", amount: "$20" },
          { id: "2", name: "Supplies", amount: "$45" },
        ]}
        getRowId={(row) => row.id}
        caption="Transactions"
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Dues")).toBeInTheDocument();

    rerender(
      <DataTable
        columns={[
          { id: "name", header: "Name", cell: (row: { name: string }) => row.name },
        ]}
        rows={[]}
        getRowId={(row) => row.name}
        emptyTitle="No transactions"
      />,
    );
    expect(screen.getByText("No transactions")).toBeInTheDocument();
  });

  it("shows DataTable error and loading", () => {
    const { rerender } = render(
      <DataTable
        columns={[{ id: "a", header: "A", cell: () => null }]}
        rows={[]}
        getRowId={() => "x"}
        error="Failed to load"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");

    rerender(
      <DataTable
        columns={[{ id: "a", header: "A", cell: () => null }]}
        rows={[]}
        getRowId={() => "x"}
        loading
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders EmptyState, Timeline, CalendarCard, ChartContainer, MetricCard", () => {
    render(
      <>
        <EmptyState title="Nothing here" description="Try again later." />
        <Timeline
          items={[
            { id: "1", title: "Joined", description: "New member", meta: "2h" },
          ]}
        />
        <CalendarCard
          title="July 2026"
          days={[
            {
              id: "1",
              label: 1,
              date: "2026-07-01",
              isToday: true,
              hasEvents: true,
            },
          ]}
        />
        <ChartContainer title="Spend" empty emptyTitle="No spend data">
          <div>chart</div>
        </ChartContainer>
        <MetricCard
          label="Balance"
          value="$1,200"
          trend="+4%"
          trendTone="success"
        />
      </>,
    );

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "July 2026" })).toBeInTheDocument();
    expect(screen.getByText("No spend data")).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getByText("+4%")).toHaveClass("text-success");
  });
});
