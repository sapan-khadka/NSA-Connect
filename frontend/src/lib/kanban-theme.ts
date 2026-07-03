import type { KanbanColumnId } from "./kanban-status";

export type KanbanColumnTheme = {
  headerBg: string;
  eventLabel: string;
  cardGradient: string;
  cardShadow: string;
  pillText: string;
  buttonBg: string;
  buttonHoverBg: string;
  progressColor: string;
  emptyBg: string;
};

export const KANBAN_COLUMN_THEMES: Record<KanbanColumnId, KanbanColumnTheme> = {
  todo: {
    headerBg: "#475569",
    eventLabel: "#334155",
    cardGradient: "linear-gradient(160deg, #F8FAFC, #F1F5F9)",
    cardShadow: "0 4px 12px rgba(71, 85, 105, 0.08)",
    pillText: "#475569",
    buttonBg: "#475569",
    buttonHoverBg: "#334155",
    progressColor: "#475569",
    emptyBg: "#F8FAFC",
  },
  in_progress: {
    headerBg: "#E8A94D",
    eventLabel: "#B45309",
    cardGradient: "linear-gradient(160deg, #FCF1E4, #FBEADC)",
    cardShadow: "0 4px 12px rgba(232, 169, 77, 0.12)",
    pillText: "#B45309",
    buttonBg: "#E8A94D",
    buttonHoverBg: "#D4923F",
    progressColor: "#E8A94D",
    emptyBg: "#F8FAFC",
  },
  done: {
    headerBg: "#027C68",
    eventLabel: "#027C68",
    cardGradient: "linear-gradient(160deg, #EFF9F3, #E7F4F0)",
    cardShadow: "0 4px 12px rgba(2, 124, 104, 0.1)",
    pillText: "#027C68",
    buttonBg: "#027C68",
    buttonHoverBg: "#016B5A",
    progressColor: "#027C68",
    emptyBg: "#F8FAFC",
  },
};

export function getKanbanColumnTheme(columnId: KanbanColumnId): KanbanColumnTheme {
  return KANBAN_COLUMN_THEMES[columnId];
}
