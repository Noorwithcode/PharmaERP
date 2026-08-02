import {
  useCallback,
  useEffect,
  useState,
} from "react";

import apiClient from
  "../api/apiClient";

import MedicineTable from
  "../modules/medicines/MedicineTable";

import MedicineForm from
  "../modules/medicines/MedicineForm";

import MedicineDetails from
  "../modules/medicines/MedicineDetails";

import "../modules/medicines/medicines.css";

const initialFilters = {
  search: "",
  categoryId: "",
  manufacturerId: "",
  isActive: "",
  page: 1,
  limit: 20,
};

const extractList = (
  response,
  keys = []
) => {
  const payload =
    response?.data?.data ??
    response?.data ??
    {};

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    ...keys.map(
      (key) =>
        payload?.[key]
    ),

    payload?.items,
    payload?.rows,
    payload?.data,
  ];

  return (
    candidates.find(
      Array.isArray
    ) || []
  );
};

const extractPagination = (
  response,
  visibleCount
) => {
  const payload =
    response?.data?.data ??
    response?.data ??
    {};

  const pagination =
    payload?.pagination ??
    {};

  const page =
    Number(
      pagination.page
    ) || 1;

  const limit =
    Number(
      pagination.limit
    ) || 20;

  const total =
    Number(
      pagination.total
    ) || visibleCount;

  const totalPages =
    Number(
      pagination.totalPages
    ) ||
    Math.max(
      Math.ceil(
        total / limit
      ),
      1
    );

  return {
    page,
    limit,
    total,
    totalPages,
  };
};

const getMedicineId = (
  medicine
) => {
  return Number(
    medicine?.id ??
    medicine?.medicineId ??
    medicine?.medicine_id
  );
};

const getErrorMessage = (
  error,
  fallback =
    "Something went wrong."
) => {
  return (
    error?.response
      ?.data?.message ||
    error?.response
      ?.data?.error ||
    error?.message ||
    fallback
  );
};

function MedicinesPage() {
  const [
    medicines,
    setMedicines,
  ] = useState([]);

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    manufacturers,
    setManufacturers,
  ] = useState([]);

  const [
    filters,
    setFilters,
  ] = useState(
    initialFilters
  );

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  /*
   * modalMode:
   * null   = closed
   * create = add medicine
   * view   = medicine details
   * edit   = edit medicine
   */
  const [
    modalMode,
    setModalMode,
  ] = useState(null);

  const [
    selectedMedicine,
    setSelectedMedicine,
  ] = useState(null);

  useEffect(() => {
    document.title =
      "Medicines | PharmaERP";
  }, []);

  /*
   * Modal open থাকলে background
   * scrolling বন্ধ থাকবে।
   */
  useEffect(() => {
    document.body
      .style
      .overflow =
      modalMode
        ? "hidden"
        : "";

    return () => {
      document.body
        .style
        .overflow = "";
    };
  }, [
    modalMode,
  ]);

  const loadMasters =
    useCallback(
      async () => {
        try {
          const [
            categoryResponse,
            manufacturerResponse,
          ] =
            await Promise.all([
              apiClient.get(
                "/categories",
                {
                  params: {
                    page: 1,
                    limit: 500,
                    isActive:
                      true,
                  },
                }
              ),

              apiClient.get(
                "/manufacturers",
                {
                  params: {
                    page: 1,
                    limit: 500,
                    isActive:
                      true,
                  },
                }
              ),
            ]);

          setCategories(
            extractList(
              categoryResponse,
              [
                "categories",
              ]
            )
          );

          setManufacturers(
            extractList(
              manufacturerResponse,
              [
                "manufacturers",
              ]
            )
          );
        } catch (
          requestError
        ) {
          console.error(
            "Unable to load medicine masters:",
            requestError
          );
        }
      },
      []
    );

  const loadMedicines =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const params = {
            page:
              filters.page,

            limit:
              filters.limit,
          };

          if (
            filters.search
              .trim()
          ) {
            params.search =
              filters.search
                .trim();
          }

          if (
            filters.categoryId
          ) {
            params.categoryId =
              filters.categoryId;
          }

          if (
            filters
              .manufacturerId
          ) {
            params
              .manufacturerId =
              filters
                .manufacturerId;
          }

          if (
            filters.isActive !==
            ""
          ) {
            params.isActive =
              filters.isActive;
          }

          const response =
            await apiClient.get(
              "/medicines",
              {
                params,
              }
            );

          const rows =
            extractList(
              response,
              [
                "medicines",
              ]
            );

          setMedicines(
            rows
          );

          setPagination(
            extractPagination(
              response,
              rows.length
            )
          );
        } catch (
          requestError
        ) {
          setMedicines([]);

          setError(
            getErrorMessage(
              requestError,
              "Unable to load medicines."
            )
          );
        } finally {
          setLoading(false);
        }
      },
      [
        filters,
      ]
    );

  useEffect(() => {
    loadMasters();
  }, [
    loadMasters,
  ]);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        loadMedicines,
        250
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    loadMedicines,
  ]);

  const updateFilter = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFilters(
      (current) => ({
        ...current,
        [name]: value,
        page: 1,
      })
    );

    setSuccess("");
  };

  const clearFilters = () => {
    setFilters(
      initialFilters
    );

    setSuccess("");
  };

  const openCreate = () => {
    setSelectedMedicine(
      null
    );

    setModalMode(
      "create"
    );

    setError("");
    setSuccess("");
  };

  const openView = (
    medicine
  ) => {
    setSelectedMedicine(
      medicine
    );

    setModalMode(
      "view"
    );

    setError("");
  };

  const openEdit = (
    medicine
  ) => {
    setSelectedMedicine(
      medicine
    );

    setModalMode(
      "edit"
    );

    setError("");
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalMode(null);
    setSelectedMedicine(
      null
    );
  };

  const createMedicine =
    async (
      payload
    ) => {
      return apiClient.post(
        "/medicines",
        payload
      );
    };

  const updateMedicine =
    async (
      medicineId,
      payload
    ) => {
      try {
        return await apiClient.put(
          `/medicines/${medicineId}`,
          payload
        );
      } catch (
        requestError
      ) {
        /*
         * যদি backend update route
         * PATCH method ব্যবহার করে।
         */
        if (
          requestError
            ?.response
            ?.status === 404 ||
          requestError
            ?.response
            ?.status === 405
        ) {
          return apiClient.patch(
            `/medicines/${medicineId}`,
            payload
          );
        }

        throw requestError;
      }
    };

  const handleSave =
    async (
      payload
    ) => {
      setSaving(true);
      setError("");
      setSuccess("");

      try {
        const medicineId =
          getMedicineId(
            selectedMedicine
          );

        if (
          modalMode ===
            "edit" &&
          medicineId
        ) {
          await updateMedicine(
            medicineId,
            payload
          );

          setSuccess(
            "Medicine updated successfully."
          );
        } else {
          await createMedicine(
            payload
          );

          setSuccess(
            "Medicine created successfully."
          );
        }

        setModalMode(null);
        setSelectedMedicine(
          null
        );

        await loadMedicines();
      } catch (
        requestError
      ) {
        setError(
          getErrorMessage(
            requestError,
            "Unable to save medicine."
          )
        );
      } finally {
        setSaving(false);
      }
    };

  const handleToggleStatus =
    async (
      medicine,
      nextStatus
    ) => {
      const medicineId =
        getMedicineId(
          medicine
        );

      if (
        !Number.isInteger(
          medicineId
        ) ||
        medicineId <= 0
      ) {
        setError(
          "Invalid medicine ID."
        );

        return;
      }

      const action =
        nextStatus
          ? "activate"
          : "deactivate";

      const confirmed =
        window.confirm(
          `Are you sure you want to ${action} this medicine?`
        );

      if (!confirmed) {
        return;
      }

      setError("");
      setSuccess("");

      try {
        try {
          await apiClient.patch(
            `/medicines/${medicineId}/status`,
            {
              isActive:
                nextStatus,
            }
          );
        } catch (
          requestError
        ) {
          /*
           * Alternative backend route:
           * PATCH /api/medicines/:id
           */
          if (
            requestError
              ?.response
              ?.status === 404 ||
            requestError
              ?.response
              ?.status === 405
          ) {
            await apiClient.patch(
              `/medicines/${medicineId}`,
              {
                isActive:
                  nextStatus,
              }
            );
          } else {
            throw requestError;
          }
        }

        setSuccess(
          nextStatus
            ? "Medicine activated successfully."
            : "Medicine deactivated successfully."
        );

        await loadMedicines();
      } catch (
        requestError
      ) {
        setError(
          getErrorMessage(
            requestError,
            `Unable to ${action} medicine.`
          )
        );
      }
    };

  const previousPage = () => {
    setFilters(
      (current) => ({
        ...current,

        page:
          Math.max(
            current.page - 1,
            1
          ),
      })
    );
  };

  const nextPage = () => {
    setFilters(
      (current) => ({
        ...current,

        page:
          Math.min(
            current.page + 1,
            pagination
              .totalPages
          ),
      })
    );
  };

  return (
    <main className="medicines-page">
      <section className="medicines-page-header">
        <div>
          <span className="medicines-eyebrow">
            Medicine master
          </span>

          <h2>
            Medicine catalogue
          </h2>

          <p>
            Manage medicine identity,
            classification, GST and
            prescription information.
          </p>
        </div>

        <button
          type="button"
          className="medicine-primary-button"
          onClick={
            openCreate
          }
        >
          + Add medicine
        </button>
      </section>

      {error && (
        <div className="medicine-page-error">
          <span>
            {error}
          </span>

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
      )}

      {success && (
        <div className="medicine-page-success">
          <span>
            {success}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section className="medicine-filters">
        <div className="medicine-search-field">
          <span className="medicine-search-icon">
            ⌕
          </span>

          <input
            type="search"
            name="search"
            value={
              filters.search
            }
            onChange={
              updateFilter
            }
            placeholder="Search brand, generic, SKU or barcode"
          />
        </div>

        <select
          name="categoryId"
          value={
            filters.categoryId
          }
          onChange={
            updateFilter
          }
          aria-label="Filter by category"
        >
          <option value="">
            All categories
          </option>

          {categories.map(
            (category) => (
              <option
                key={
                  category.id
                }
                value={
                  category.id
                }
              >
                {category.name}
              </option>
            )
          )}
        </select>

        <select
          name="manufacturerId"
          value={
            filters
              .manufacturerId
          }
          onChange={
            updateFilter
          }
          aria-label="Filter by manufacturer"
        >
          <option value="">
            All manufacturers
          </option>

          {manufacturers.map(
            (
              manufacturer
            ) => (
              <option
                key={
                  manufacturer.id
                }
                value={
                  manufacturer.id
                }
              >
                {
                  manufacturer.name
                }
              </option>
            )
          )}
        </select>

        <select
          name="isActive"
          value={
            filters.isActive
          }
          onChange={
            updateFilter
          }
          aria-label="Filter by status"
        >
          <option value="">
            All statuses
          </option>

          <option value="true">
            Active
          </option>

          <option value="false">
            Inactive
          </option>
        </select>

        <button
          type="button"
          className="medicine-secondary-button"
          onClick={
            clearFilters
          }
        >
          Clear filters
        </button>
      </section>

      <MedicineTable
        medicines={
          medicines
        }
        loading={
          loading
        }
        error=""
        onView={
          openView
        }
        onEdit={
          openEdit
        }
        onToggleStatus={
          handleToggleStatus
        }
      />

      <section className="medicine-pagination">
        <span className="medicine-pagination-info">
          Showing{" "}
          {medicines.length}
          {" of "}
          {
            pagination.total
          }
          {" medicine(s)"}
        </span>

        <div className="medicine-pagination-actions">
          <button
            type="button"
            onClick={
              previousPage
            }
            disabled={
              loading ||
              pagination.page <= 1
            }
          >
            Previous
          </button>

          <span className="medicine-page-number">
            Page{" "}
            {pagination.page}
            {" of "}
            {
              pagination
                .totalPages
            }
          </span>

          <button
            type="button"
            onClick={
              nextPage
            }
            disabled={
              loading ||
              pagination.page >=
                pagination
                  .totalPages
            }
          >
            Next
          </button>
        </div>
      </section>

      {modalMode && (
        <div
          className="medicine-modal-overlay"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div
            className={
              `medicine-modal ${
                modalMode ===
                "view"
                  ? "details-modal"
                  : ""
              }`
            }
            role="dialog"
            aria-modal="true"
          >
            {modalMode ===
            "view" ? (
              <MedicineDetails
                medicine={
                  selectedMedicine
                }
                onClose={
                  closeModal
                }
                onEdit={() =>
                  setModalMode(
                    "edit"
                  )
                }
              />
            ) : (
              <MedicineForm
                medicine={
                  modalMode ===
                  "edit"
                    ? selectedMedicine
                    : null
                }
                categories={
                  categories
                }
                manufacturers={
                  manufacturers
                }
                saving={
                  saving
                }
                onSubmit={
                  handleSave
                }
                onCancel={
                  closeModal
                }
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default MedicinesPage;