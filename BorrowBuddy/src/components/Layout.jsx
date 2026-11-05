import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { pendingIncomingCount } from "../borrowing/model";
import { useMyLoans } from "../borrowing/useLoans";
import "../borrowing/Borrowing.css";
import { Avatar } from "./Avatar";
import { Icon } from "./icons";
import "./Layout.css";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="BorrowBuddy home">
      <img src="/favicon.svg" alt="" width="30" height="30" />
      <span>BorrowBuddy</span>
    </Link>
  );
}

function AccountLink() {
  const { user, profile, loading } = useAuth();
  if (loading) return <span className="account-placeholder" aria-hidden="true" />;
  if (!user) return <Link to="/signin" className="button button-primary button-small">Sign in</Link>;

  const name = profile?.displayName || user.displayName || "Your profile";
  return (
    <Link to="/profile" className="account-link" aria-label={`Your profile, ${name}`}>
      <Avatar name={name} photoURL={profile?.photoURL ?? user.photoURL} size={34} />
      <span className="account-name">{name.split(" ")[0]}</span>
    </Link>
  );
}

function BottomTab({ to, icon, end, badge, children }) {
  return (
    <NavLink to={to} end={end} className="tab">
      <Icon name={icon} size={22} />
      <span>{children}</span>
      {badge}
    </NavLink>
  );
}

// Requests from other people that are waiting for this person to accept or decline.
function WaitingBadge({ count }) {
  if (!count) return null;
  return <span className="nav-badge" aria-label={`${count} waiting`}>{count}</span>;
}

export function Layout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const loans = useMyLoans(user?.uid);
  const waiting = user ? pendingIncomingCount(loans.data, user.uid) : 0;

  // Opening a new page should start at the top, not wherever the last page was scrolled.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="site-header">
        <div className="container site-header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Main">
            <NavLink to="/browse" className="nav-link">Browse</NavLink>
            <NavLink to="/list" className="nav-link">List an item</NavLink>
            {user && <NavLink to="/my-listings" className="nav-link">My listings</NavLink>}
            {user && <NavLink to="/loans" className="nav-link">Loans<WaitingBadge count={waiting} /></NavLink>}
          </nav>
          <AccountLink />
        </div>
      </header>

      <main id="main" className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <Logo />
          <p>Borrow what you need from students on your campus.</p>
        </div>
      </footer>

      <nav className="bottom-nav" aria-label="Main">
        <BottomTab to="/" icon="home" end>Home</BottomTab>
        <BottomTab to="/browse" icon="search">Browse</BottomTab>
        <BottomTab to="/list" icon="plus">List</BottomTab>
        {user && <BottomTab to="/loans" icon="loans" badge={<WaitingBadge count={waiting} />}>Loans</BottomTab>}
        <BottomTab to={user ? "/profile" : "/signin"} icon="user">{user ? "Profile" : "Sign in"}</BottomTab>
      </nav>
    </div>
  );
}
