import { useLocation } from "react-router";
import "./ModulePlaceholderPage.css";

const moduleInformation = {
  "/sales": {
    code: "SL",
    title: "Sales Module",
    description:
      "Billing, payment এবং sales invoice management এখানে তৈরি হবে।",
  },

  "/purchases": {
    code: "PR",
    title: "Purchase Module",
    description:
      "Supplier purchase এবং payment management এখানে তৈরি হবে।",
  },

  "/medicines": {
    code: "MD",
    title: "Medicine Module",
    description:
      "Medicine master, category এবং manufacturer এখানে manage হবে।",
  },

  "/stock": {
    code: "ST",
    title: "Stock Module",
    description:
      "Batch stock, expiry এবং adjustments এখানে manage হবে।",
  },

  "/reports": {
    code: "RP",
    title: "Reports Module",
    description:
      "Sales, purchase এবং inventory reports এখানে দেখানো হবে।",
  },

  "/settings": {
    code: "SE",
    title: "Settings Module",
    description:
      "Pharmacy এবং system configuration এখানে manage হবে।",
  },
};

function ModulePlaceholderPage() {
  const location = useLocation();

  const information =
    moduleInformation[location.pathname] ||
    {
      code: "PE",
      title: "PharmaERP Module",
      description:
        "এই module শীঘ্রই তৈরি হবে।",
    };

  return (
    <section className="module-placeholder">
      <div className="module-code">
        {information.code}
      </div>

      <p>PharmaERP</p>

      <h2>{information.title}</h2>

      <span>
        {information.description}
      </span>
    </section>
  );
}

export default ModulePlaceholderPage;