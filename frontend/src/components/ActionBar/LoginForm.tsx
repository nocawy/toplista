// LoginForm.tsx
import React, { useState, useEffect } from "react";
import { handleLogin } from "../../api/loginApi";
import { useAuth } from "../../contexts/AuthContext";

const LoginForm: React.FC = () => {
  const [password, setPassword] = useState<string>("");
  const { isLoggedIn, login, logout, username } = useAuth();

  const submitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const success = await handleLogin("demo", password);
    if (success) {
      login("demo");
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
          placeholder="type 'demo'"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit" className="text-button">
        log in to edit
      </button>
    </form>
  );
};

export default LoginForm;
