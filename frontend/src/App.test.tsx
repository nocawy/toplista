import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";
import apiClient from "./api/apiClient";
import { RankingProvider } from "./contexts/RankingContext";

jest.mock("./api/apiClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({
      data: [{ id: 1, name: "Main", slug: "main", created_on: "" }],
    }),
  },
}));

test("renders the application heading", async () => {
  const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
  mockedGet.mockResolvedValue({
    data: [{ id: 1, name: "Main", slug: "main", created_on: "" }],
  } as never);
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);

  render(
    <RankingProvider>
      <App />
    </RankingProvider>
  );

  expect(screen.getByRole("heading", { name: /osobisty top wszech czasów/i })).toBeInTheDocument();
  expect(await screen.findByRole("tab", { name: "Main" })).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith("rankings/");
  fetchMock.mockRestore();
});
