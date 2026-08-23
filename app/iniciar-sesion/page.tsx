"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
export default function IniciarSesionPage() {
  const router = useRouter();
  const { login, signUp, signInWithOAuth, resetPassword } = useAuth();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSent(false);
    setLoading(true);
    const { error: authError } =
      tab === "in"
        ? await login(email, pass)
        : await signUp(
            email,
            pass,
            (user || "PLAYER1").toUpperCase().slice(0, 10),
          );
    setLoading(false);
    if (authError) {
      setError(mapAuthError(authError, tab));
      return;
    }
    if (tab === "up") {
      setError(null);
      setResetSent(false);
      setLoading(false);
      // El registro exige confirmación de email antes de poder iniciar sesión.
      setError(
        "Cuenta creada. Revisa tu correo para confirmar la cuenta antes de iniciar sesión.",
      );
      setTab("in");
      return;
    }
    router.push("/");
  };
  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    await signInWithOAuth(provider);
  };
  const handleForgotPassword = async () => {
    setError(null);
    setResetSent(false);
    if (!email) {
      setError("Ingresa tu correo electrónico primero.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await resetPassword(email);
    setLoading(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    setResetSent(true);
  };
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>
        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => {
              setTab("in");
              setError(null);
              setResetSent(false);
            }}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => {
              setTab("up");
              setError(null);
              setResetSent(false);
            }}
          >
            CREAR CUENTA
          </button>
        </div>
        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="px_kai"
              />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {tab === "in" && (
            <button
              type="button"
              className="mono"
              onClick={handleForgotPassword}
              style={{
                background: "none",
                border: "none",
                color: "var(--ink-faint)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
                marginTop: 4,
              }}
            >
              ¿OLVIDASTE TU CONTRASEÑA?
            </button>
          )}
          {resetSent && (
            <div
              className="mono"
              style={{ color: "var(--cyan)", fontSize: 12, marginTop: 8 }}
            >
              Correo de recuperación enviado. Revisa tu bandeja de entrada.
            </div>
          )}
          {error && (
            <div
              className="mono"
              style={{ color: "var(--magenta)", fontSize: 12, marginTop: 8 }}
            >
              {error}
            </div>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading
              ? "..."
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>
        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/")}
        >
          JUGAR COMO INVITADO
        </button>
        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => handleOAuth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => handleOAuth("github")}
          >
            ▣ GITHUB
          </button>
        </div>
        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
function mapAuthError(message: string, tab: "in" | "up"): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Credenciales inválidas. Verifica tu correo y contraseña.";
  }
  if (lower.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de iniciar sesión.";
  }
  if (
    lower.includes("user already registered") ||
    lower.includes("already registered")
  ) {
    return "Ese correo ya está registrado. Intenta iniciar sesión.";
  }
  if (lower.includes("password") && lower.includes("6")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return "Error de red. Intenta de nuevo.";
  }
  return tab === "in"
    ? "No se pudo iniciar sesión. Intenta de nuevo."
    : "No se pudo crear la cuenta. Intenta de nuevo.";
}
