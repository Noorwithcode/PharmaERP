import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate
} from "react-router";

import {
  useAuth
} from "../context/AuthContext";

import "./AppLayout.css";

const menuItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "DB",
    end: true
  },
  {
    label: "Sales",
    path: "/sales",
    icon: "SL",
    end: true
  },
  {
    label: "Sales History",
    path: "/sales/history",
    icon: "SH",
    end: true
  },
  {
    label: "Purchases",
    path: "/purchases",
    icon: "PR",
    end: true
  },
  {
    label: "Medicines",
    path: "/medicines",
    icon: "MD",
    end: true
  },
  {
    label: "Stock",
    path: "/stock",
    icon: "ST",
    end: true
  },
  {
    label: "Stock Adjustment",
    path: "/stock/adjustments",
    icon: "SA",
    end: true
  },
  {
    label: "Reports",
    path: "/reports",
    icon: "RP",
    end: true
  },
  {
    label: "Settings",
    path: "/settings",
    icon: "SE",
    end: true
  }
];

const pageTitles = {
  "/dashboard": {
    title: "Dashboard",
    subtitle:
      "Pharmacy performance overview"
  },

  "/sales": {
    title: "Sales",
    subtitle:
      "Create bills and manage sales"
  },

  "/sales/history": {
    title: "Sales History",
    subtitle:
      "Search invoices and review sales"
  },

  "/purchases": {
    title: "Purchases",
    subtitle:
      "Manage supplier purchases"
  },

  "/medicines": {
    title: "Medicines",
    subtitle:
      "Manage medicine catalogue"
  },

  "/stock": {
    title: "Stock Management",
    subtitle:
      "Track batches, stock and expiry"
  },

  "/stock/adjustments": {
    title: "Stock Adjustment",
    subtitle:
      "Correct stock and review adjustment history"
  },

  "/reports": {
    title: "Reports",
    subtitle:
      "Business and inventory reports"
  },

  "/settings": {
    title: "Settings",
    subtitle:
      "Configure PharmaERP"
  }
};

const roleLabels = {
  1: "Admin",
  2: "Manager",
  3: "Pharmacist",
  4: "Cashier",

  admin: "Admin",
  manager: "Manager",
  pharmacist: "Pharmacist",
  cashier: "Cashier"
};

const getCurrentPage = (
  pathname
) => {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  /*
   * Dynamic or nested routes-এর জন্য
   * longest matching route খোঁজা হবে।
   */
  const matchingPath =
    Object.keys(pageTitles)
      .sort(
        (first, second) =>
          second.length -
          first.length
      )
      .find((path) => {
        return pathname.startsWith(
          `${path}/`
        );
      });

  if (matchingPath) {
    return pageTitles[matchingPath];
  }

  return {
    title: "PharmaERP",
    subtitle:
      "Medicine billing and inventory"
  };
};

function AppLayout() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const {
    user,
    logout
  } = useAuth();

  const [
    sidebarOpen,
    setSidebarOpen
  ] = useState(false);

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.full_name ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "User";

  const rawRole =
    user?.roleName ||
    user?.role_name ||
    user?.role ||
    "Staff";

  const normalizedRole =
    String(rawRole)
      .trim()
      .toLowerCase();

  const displayRole =
    roleLabels[normalizedRole] ||
    roleLabels[rawRole] ||
    String(rawRole);

  const avatarLetter =
    displayName
      .charAt(0)
      .toUpperCase() ||
    "U";

  const currentPage =
    useMemo(() => {
      return getCurrentPage(
        location.pathname
      );
    }, [location.pathname]);

  /*
   * Navigation change হলে mobile
   * sidebar automatically বন্ধ হবে।
   */
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  /*
   * Mobile sidebar:
   * - body scroll lock
   * - Escape key close
   * - desktop resize হলে close
   */
  useEffect(() => {
    const handleKeyDown = (
      event
    ) => {
      if (
        event.key === "Escape" &&
        sidebarOpen
      ) {
        setSidebarOpen(false);
      }
    };

    const handleResize = () => {
      if (
        window.innerWidth > 820
      ) {
        setSidebarOpen(false);
      }
    };

    document.body.style.overflow =
      sidebarOpen
        ? "hidden"
        : "";

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      document.body.style.overflow =
        "";

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [sidebarOpen]);

  const openSidebar = () => {
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    closeSidebar();

    logout();

    navigate(
      "/login",
      {
        replace: true
      }
    );
  };

  return (
    <div className="app-shell">
      {/* Mobile sidebar overlay */}

      <button
        type="button"
        className={
          `sidebar-overlay ${
            sidebarOpen
              ? "is-visible"
              : ""
          }`
        }
        onClick={closeSidebar}
        aria-label="Close navigation menu"
        tabIndex={
          sidebarOpen
            ? 0
            : -1
        }
      />

      {/* Main sidebar */}

      <aside
        id="pharmaerp-sidebar"
        className={
          `app-sidebar ${
            sidebarOpen
              ? "is-open"
              : ""
          }`
        }
        aria-label="Main navigation"
      >
        <div className="sidebar-header">
          <div
            className="sidebar-logo"
            aria-hidden="true"
          >
            P
          </div>

          <div className="sidebar-brand">
            <strong>
              PharmaERP
            </strong>

            <span>
              Pharmacy Management
            </span>
          </div>

          <button
            type="button"
            className="sidebar-close"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <div className="sidebar-section-label">
          Main menu
        </div>

        <nav className="sidebar-navigation">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={closeSidebar}
              className={({
                isActive
              }) => {
                return (
                  `sidebar-link ${
                    isActive
                      ? "is-active"
                      : ""
                  }`
                );
              }}
            >
              <span
                className="sidebar-icon"
                aria-hidden="true"
              >
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div
              className="user-avatar"
              aria-hidden="true"
            >
              {avatarLetter}
            </div>

            <div className="user-details">
              <strong>
                {displayName}
              </strong>

              <span>
                {displayRole}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main application content */}

      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <button
              type="button"
              className="menu-button"
              onClick={openSidebar}
              aria-label="Open navigation menu"
              aria-expanded={
                sidebarOpen
              }
              aria-controls="pharmaerp-sidebar"
            >
              <span />
              <span />
              <span />
            </button>

            <div className="page-heading">
              <h1>
                {currentPage.title}
              </h1>

              <p>
                {currentPage.subtitle}
              </p>
            </div>
          </div>

          <div className="header-right">
            <div className="header-user">
              <div>
                <strong>
                  {displayName}
                </strong>

                <span>
                  {displayRole}
                </span>
              </div>

              <div
                className="header-avatar"
                aria-label={
                  `${displayName} avatar`
                }
              >
                {avatarLetter}
              </div>
            </div>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;