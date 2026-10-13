import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import type { RecipeRecord } from "../../../shared/domain.ts";
import { DetailPage } from "./DetailPage";
import { SessionProvider } from "../session";

const recipe: RecipeRecord = {
  id: 1,
  title: "番茄炒蛋",
  douyinUrl: "https://v.douyin.com/iRk8aXc/",
  ingredients: [
    { name: "番茄", amount: "2 个" },
    { name: "鸡蛋", amount: "3 个" },
  ],
  steps: ["番茄顶部划十字，开水烫 30 秒后去皮，切滚刀块。", "炒到凝固就盛出。"],
  images: [
    { key: "ab".repeat(16) + ".jpg", filename: "IMG_0412.jpg", bytes: 1200, contentType: "image/jpeg" },
  ],
  createdAt: "2026-10-08T02:00:00.000Z",
  updatedAt: "2026-10-08T02:00:00.000Z",
};

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

it("shows ingredients, numbered steps, the video link, and a larger shot", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/session")) return json({ authenticated: true });
      return json(recipe);
    }),
  );
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={["/1"]}>
        <Routes>
          <Route path="/:id" element={<DetailPage />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
  expect(await screen.findByRole("heading", { name: "番茄炒蛋" })).toBeTruthy();
  expect(screen.getByText("2 个")).toBeTruthy();
  expect(screen.getByText("2026-10-08 录入 · 2 种食材 · 2 步")).toBeTruthy();
  expect(screen.getByText("1").className).toContain("n");
  expect(screen.getByText("番茄顶部划十字，开水烫 30 秒后去皮，切滚刀块。")).toBeTruthy();
  const video = screen.getByRole("link", { name: "▶ 看原视频" });
  expect(video.getAttribute("href")).toBe("https://v.douyin.com/iRk8aXc/");
  expect(video.getAttribute("target")).toBe("_blank");
  await user.click(screen.getByRole("button", { name: "查看截图 IMG_0412.jpg" }));
  const shot = screen.getByRole("dialog");
  expect(shot.querySelector("img")?.getAttribute("src")).toBe(`/recipes/img/${"ab".repeat(16)}.jpg`);
});
