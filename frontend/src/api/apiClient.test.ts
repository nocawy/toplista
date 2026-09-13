import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { waitFor } from "@testing-library/react";
import apiClient from "./apiClient";
import { getStorageItem, setStorageItem } from "../utils/appStorage";

function requestConfig(url: string): InternalAxiosRequestConfig {
  return {
    url,
    method: "get",
    headers: new AxiosHeaders({ Authorization: "Bearer old-access" }),
  } as InternalAxiosRequestConfig;
}

describe("apiClient token refresh", () => {
  beforeEach(() => {
    localStorage.clear();
    setStorageItem("accessToken", "old-access");
    setStorageItem("refreshToken", "old-refresh");
    jest.restoreAllMocks();
  });

  afterEach(() => {
    delete apiClient.defaults.adapter;
  });

  test("stores the rotated refresh token after a 401", async () => {
    const postSpy = jest.spyOn(axios, "post").mockResolvedValue({
      data: { access: "new-access", refresh: "new-refresh" },
    } as never);

    apiClient.defaults.adapter = async (config) => {
      if (config.headers?.Authorization === "Bearer new-access") {
        return {
          data: { ok: true },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      }
      const error = Object.assign(new Error("Unauthorized"), {
        config,
        response: { status: 401, data: {}, headers: {}, config },
      });
      throw error;
    };

    const response = await apiClient.get("/songs/", requestConfig("/songs/"));

    expect(response.data).toEqual({ ok: true });
    expect(getStorageItem("accessToken")).toBe("new-access");
    expect(getStorageItem("refreshToken")).toBe("new-refresh");
    expect(postSpy).toHaveBeenCalledWith("api/token/refresh/", {
      refresh: "old-refresh",
    });
  });

  test("coalesces concurrent 401s onto a single refresh request", async () => {
    let resolveRefresh: (value: {
      data: { access: string; refresh: string };
    }) => void = () => undefined;
    const postSpy = jest.spyOn(axios, "post").mockImplementation(
      () =>
        new Promise<{ data: { access: string; refresh: string } }>((resolve) => {
          resolveRefresh = resolve;
        }) as ReturnType<typeof axios.post>
    );

    apiClient.defaults.adapter = async (config) => {
      if (config.headers?.Authorization === "Bearer new-access") {
        return {
          data: { ok: true },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      }
      const error = Object.assign(new Error("Unauthorized"), {
        config,
        response: { status: 401, data: {}, headers: {}, config },
      });
      throw error;
    };

    const first = apiClient.get("/songs/", requestConfig("/songs/"));
    const second = apiClient.get("/rankings/", requestConfig("/rankings/"));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledTimes(1);
    });

    resolveRefresh({ data: { access: "new-access", refresh: "new-refresh" } });

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.data).toEqual({ ok: true });
    expect(secondResponse.data).toEqual({ ok: true });
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(getStorageItem("refreshToken")).toBe("new-refresh");
  });
});
