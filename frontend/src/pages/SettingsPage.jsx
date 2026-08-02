import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import PharmacySettingsForm from
  "../modules/settings/PharmacySettingsForm";

import settingsService from
  "../services/settingsService";

import "../modules/settings/settings.css";

const decodeJwtPayload = (
  token
) => {
  try {
    if (!token) {
      return null;
    }

    const payloadPart =
      token.split(".")[1];

    if (!payloadPart) {
      return null;
    }

    const normalizedPayload =
      payloadPart
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const paddedPayload =
      normalizedPayload.padEnd(
        Math.ceil(
          normalizedPayload.length / 4
        ) * 4,
        "="
      );

    return JSON.parse(
      window.atob(paddedPayload)
    );
  } catch {
    return null;
  }
};

const getStoredUser = () => {
  const userKeys = [
    "pharmaerp_user",
    "user",
    "auth_user"
  ];

  for (const key of userKeys) {
    try {
      const storedValue =
        localStorage.getItem(key);

      if (storedValue) {
        return JSON.parse(
          storedValue
        );
      }
    } catch {
      // Continue checking other keys.
    }
  }

  const tokenKeys = [
    "pharmaerp_token",
    "token",
    "authToken",
    "accessToken"
  ];

  for (const key of tokenKeys) {
    const token =
      localStorage.getItem(key);

    const decodedUser =
      decodeJwtPayload(token);

    if (decodedUser) {
      return decodedUser;
    }
  }

  return null;
};

const canUserEditSettings = (
  user
) => {
  const role =
    user?.role ??
    user?.roleId ??
    user?.role_id;

  const allowedRoles = [
    "admin",
    "manager",
    "ADMIN",
    "MANAGER",
    1,
    2,
    "1",
    "2"
  ];

  return allowedRoles.includes(role);
};

const formatDateTime = (
  dateValue
) => {
  if (!dateValue) {
    return "Not updated yet";
  }

  const parsedDate =
    new Date(dateValue);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(parsedDate);
};

const SettingsPage = () => {
  const [settings, setSettings] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const currentUser = useMemo(
    () => getStoredUser(),
    []
  );

  const canEdit = useMemo(() => {
    return canUserEditSettings(
      currentUser
    );
  }, [currentUser]);

  const loadSettings = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");
        setSuccessMessage("");

        const result =
          await settingsService
            .getSettings();

        if (!result) {
          throw new Error(
            "Settings data was not found."
          );
        }

        setSettings(result);
      } catch (requestError) {
        setError(
          settingsService
            .getErrorMessage(
              requestError,
              "Unable to load pharmacy settings."
            )
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (
    payload
  ) => {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const updatedSettings =
        await settingsService
          .updateSettings(payload);

      if (!updatedSettings) {
        throw new Error(
          "Updated settings were not returned."
        );
      }

      setSettings(
        updatedSettings
      );

      setSuccessMessage(
        "Pharmacy settings saved successfully."
      );
    } catch (requestError) {
      setError(
        settingsService
          .getErrorMessage(
            requestError,
            "Unable to save pharmacy settings."
          )
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <section className="settings-loading-card">
          <div className="settings-spinner" />

          <h2>
            Loading settings...
          </h2>

          <p>
            Retrieving pharmacy and
            system preferences.
          </p>
        </section>
      </div>
    );
  }

  if (
    error &&
    !settings
  ) {
    return (
      <div className="settings-page">
        <section className="settings-error-card">
          <div className="settings-state-icon">
            !
          </div>

          <h2>
            Unable to load settings
          </h2>

          <p>{error}</p>

          <button
            type="button"
            className="settings-primary-button"
            onClick={loadSettings}
          >
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <section className="settings-page-hero">
        <div>
          <span className="settings-eyebrow">
            System administration
          </span>

          <h1>
            Pharmacy settings
          </h1>

          <p>
            Manage pharmacy identity,
            invoice preferences and
            inventory alert rules.
          </p>
        </div>

        <div className="settings-hero-summary">
          <span>
            Current configuration
          </span>

          <strong>
            Version{" "}
            {settings?.version || 1}
          </strong>

          <small>
            Updated{" "}
            {formatDateTime(
              settings?.updatedAt
            )}
          </small>
        </div>
      </section>

      {successMessage && (
        <div className="settings-alert settings-alert-success">
          <div>
            <strong>
              Settings updated
            </strong>

            <span>
              {successMessage}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage("")
            }
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {error && settings && (
        <div className="settings-alert settings-alert-error">
          <div>
            <strong>
              Settings update failed
            </strong>

            <span>{error}</span>
          </div>

          <div className="settings-alert-actions">
            <button
              type="button"
              className="settings-alert-refresh"
              onClick={loadSettings}
            >
              Refresh latest
            </button>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <section className="settings-access-card">
        <div className="settings-access-icon">
          {canEdit ? "AD" : "RO"}
        </div>

        <div>
          <strong>
            {canEdit
              ? "Administrative access"
              : "Read-only access"}
          </strong>

          <p>
            {canEdit
              ? (
                "You can update pharmacy " +
                "and system settings."
              )
              : (
                "Only administrators and " +
                "managers can change settings."
              )}
          </p>
        </div>

        <button
          type="button"
          className="settings-secondary-button"
          onClick={loadSettings}
          disabled={saving}
        >
          Refresh data
        </button>
      </section>

      <PharmacySettingsForm
        settings={settings}
        saving={saving}
        canEdit={canEdit}
        onSubmit={handleSave}
      />
    </div>
  );
};

export default SettingsPage;