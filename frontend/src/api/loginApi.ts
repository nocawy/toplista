// api/loginApi.ts

export const handleLogin = async (
  username: string,
  password: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const data = await response.json();
    console.log("Login successful:", data);

    localStorage.setItem("accessToken", data.access);
    if (data.refresh) {
      localStorage.setItem("refreshToken", data.refresh);
    }

    return true;
  } catch (error) {
    console.error("Login error:", error);
    return false;
  }
};
