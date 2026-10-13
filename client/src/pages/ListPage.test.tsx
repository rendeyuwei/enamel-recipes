import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { RecipeCard } from "../../../shared/domain.ts";
import { ListPage } from "./ListPage";
import { SessionProvider } from "../session";

const egg: RecipeCard = {
  id: 1,
  title: "番茄炒蛋",
  ingredients: [
    { name: "番茄", amount: "2 个" },
    { name: "鸡蛋", amount: "3 个" },
  ],
  stepCount: 4,
  coverKey: null,
  createdAt: "2026-10-08T02:00:00.000Z",
};

const potato: RecipeCard = {
  id: 2,
  title: "酸辣土豆丝",
  ingredients: [{ name: "土豆", amount: "1 个" }],
  stepCount: 5,
  coverKey: null,
  createdAt: "2026-10-02T02:00:00.000Z",
};

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/session")) return json({ authenticated: true });
      return json({ total: 2, addedThisWeek: 1, recipes: [egg, potato] });
    }),
  );
});

function renderList() {
  return render(
    <SessionProvider>
      <MemoryRouter>
        <ListPage />
      </MemoryRouter>
    </SessionProvider>,
  );
}

it("shows the book and filters by an ingredient", async () => {
  const user = userEvent.setup();
  renderList();
  expect(await screen.findByText("番茄炒蛋")).toBeTruthy();
  expect(screen.getByText("共 2 道 · 本周新增 1")).toBeTruthy();
  expect(screen.getByText("已登录 · 管理员")).toBeTruthy();
  await user.type(screen.getByLabelText("搜索菜谱"), "土豆");
  await user.click(screen.getByRole("button", { name: "搜索" }));
  expect(screen.queryByText("番茄炒蛋")).toBeNull();
  expect(screen.getByText("酸辣土豆丝")).toBeTruthy();
  expect(screen.getByText("找到 1 道")).toBeTruthy();
});

it("tells a guest the book is empty", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/session")) return json({ authenticated: false });
      return json({ total: 0, addedThisWeek: 0, recipes: [] });
    }),
  );
  renderList();
  expect(await screen.findByText("还没有菜谱，登录后可编辑，添加第一道菜")).toBeTruthy();
});
