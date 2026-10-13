import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { FormPage } from "./FormPage";
import { SessionProvider } from "../session";

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

it("asks for a title before it writes a recipe", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    if (url.endsWith("/session")) return json({ authenticated: true });
    return json({ error: "unexpected" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <FormPage mode="new" />
      </MemoryRouter>
    </SessionProvider>,
  );
  await user.click(await screen.findByRole("button", { name: "保存这道菜" }));
  expect(await screen.findByText("请填写菜名")).toBeTruthy();
  const urls = fetchMock.mock.calls.map((call) => String(call[0]));
  expect(urls.some((url) => url.endsWith("/recipes"))).toBe(false);
});
