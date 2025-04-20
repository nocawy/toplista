// LoginForm.tsx
import React, { useState } from "react";
import { handleLogin } from "../../api/loginApi";
import { useAuth } from "../../contexts/AuthContext";

const LoginForm: React.FC = () => {
  const [password, setPassword] = useState<string>("");
  const { isLoggedIn, login, logout, username } = useAuth();
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const isDemo = process.env.REACT_APP_DEMO_MODE === "true";
  const user = isDemo ? "demo" : "admin";

  const submitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const success = await handleLogin(user, password);
      if (success) {
        login(user);
        setErrors({});
      }
    } catch (error) {
      setErrors({ password: "wrong password" });
      console.error("Login error:", error);
    }
  };

  if (isLoggedIn) {
    return (
      <div>
        {`logged in as ${username}`}
        <br />
        <button onClick={logout} className="text-button">
          log out
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submitForm}>
      <div>
        <input
          className="login-form"
          type="password"
          id="password"
          placeholder={isDemo ? "type 'demo'" : ""}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {errors.password && <div className="error">{errors.password}</div>}
      <button type="submit" className="text-button">
        log in to edit
      </button>
    </form>
  );
};

export default LoginForm;
