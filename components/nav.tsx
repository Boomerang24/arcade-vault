"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isHome = pathname === "/";
  const isBiblioteca =
    pathname === "/biblioteca" || pathname.startsWith("/juego/");
  const isSalon = pathname === "/salon-de-la-fama";
  const isAbout = pathname === "/about";
  const isAuth = pathname === "/iniciar-sesion";
  const close = () => setOpen(false);
  useEffect(() => {
    if (!menuOpen && !confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, confirmOpen]);
  const askLogout = () => {
    setMenuOpen(false);
    setOpen(false);
    setConfirmOpen(true);
  };
  const confirmLogout = async () => {
    await logout();
    setConfirmOpen(false);
    router.refresh();
  };
  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isHome ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={isBiblioteca ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon-de-la-fama" className={isSalon ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isAbout ? "active" : ""}>
            Sobre nosotros
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <div className="av-account">
            <button
              className="btn ghost auth-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {user.name} ▾
            </button>
            {menuOpen && (
              <>
                <div
                  className="av-menu-backdrop"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="av-account-menu" role="menu">
                  <div className="who">
                    <div className="pixel name">{user.name}</div>
                    <div className="mono email">{user.email}</div>
                  </div>
                  <div className="sep" />
                  <button
                    className="item danger"
                    role="menuitem"
                    onClick={askLogout}
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link href="/iniciar-sesion" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>
      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link href="/" className={isHome ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className={isBiblioteca ? "active" : ""}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link
          href="/salon-de-la-fama"
          className={isSalon ? "active" : ""}
          onClick={close}
        >
          Salón de la Fama
        </Link>
        <Link href="/about" className={isAbout ? "active" : ""} onClick={close}>
          Sobre nosotros
        </Link>
        {user ? (
          <button
            className="mobile-logout"
            onClick={() => {
              close();
              setConfirmOpen(true);
            }}
          >
            Cerrar sesión
          </button>
        ) : (
          <Link
            href="/iniciar-sesion"
            className={isAuth ? "active" : ""}
            onClick={close}
          >
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
      {confirmOpen && (
        <div className="modal-bd" onClick={() => setConfirmOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>¿Cerrar sesión?</h2>
            <p>Volverás a modo invitado y no podrás guardar puntajes.</p>
            <div className="actions">
              <button
                className="btn ghost"
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button className="btn magenta" onClick={confirmLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
