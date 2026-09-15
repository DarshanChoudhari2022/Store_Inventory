import Link from "next/link";
import "../legal.css";

export const metadata = {
  title: "Terms of Service | StoreStock",
  description: "Terms of Service for StoreStock retail inventory and billing software.",
};

export default function TermsOfServicePage() {
  return (
    <main className="legal-page">
      <div className="legal-wrap">
        <Link href="/" className="legal-back">
          StoreStock
        </Link>
        <article className="legal-card">
          <span className="legal-kicker">StoreStock legal</span>
          <h1>Terms of Service</h1>
          <p className="legal-meta">Last updated: September 15, 2026</p>
          <p>
            These Terms of Service govern access to and use of StoreStock, a retail inventory,
            billing, reporting, and shop management workspace. By signing in or using StoreStock,
            you agree to these terms.
          </p>

          <h2>1. Use of StoreStock</h2>
          <p>
            StoreStock is intended for retail shop operations, including product catalogues,
            invoices, customer credit, supplier purchases, cash registers, reports, and related
            workflows. You are responsible for the accuracy of the information entered by your
            owners, managers, cashiers, and operators.
          </p>

          <h2>2. Accounts and access</h2>
          <p>
            You must keep usernames, passwords, and shop access details confidential. You are
            responsible for all activity performed through your accounts. Super admins and shop
            owners should create only the operator accounts needed for their stores and remove or
            pause access when staff responsibilities change.
          </p>

          <h2>3. Billing, tax, and reports</h2>
          <p>
            StoreStock can generate invoices, GST workpapers, stock reports, and accounting-style
            exports. These outputs depend on the data and settings entered in the system. You should
            review invoices, taxes, reports, and filings with a qualified accountant or advisor
            before relying on them for statutory submission or financial decisions.
          </p>

          <h2>4. Customer and supplier data</h2>
          <p>
            You must have the right to enter and process customer, supplier, staff, and shop data in
            StoreStock. Do not upload unlawful, harmful, or unrelated personal data. Use access roles
            carefully so each operator sees only the information needed for their work.
          </p>

          <h2>5. Acceptable use</h2>
          <ul>
            <li>Do not attempt to bypass authentication, tenant isolation, rate limits, or security controls.</li>
            <li>Do not use StoreStock for illegal activity or fraudulent invoices, reports, or transactions.</li>
            <li>Do not interfere with the availability, performance, or integrity of the service.</li>
            <li>Do not upload malicious files, scripts, or content designed to harm systems or users.</li>
          </ul>

          <h2>6. Availability and changes</h2>
          <p>
            We aim to keep StoreStock reliable and fast, but the service may be unavailable during
            maintenance, upgrades, outages, or network failures. Features may be improved, changed,
            limited, or removed as the product evolves.
          </p>

          <h2>7. Data backups and exports</h2>
          <p>
            StoreStock may provide reports and exports to help you keep business records. You should
            maintain your own business records and backup practices, especially for accounting,
            statutory, and audit needs.
          </p>

          <h2>8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, StoreStock is provided without warranties of
            uninterrupted operation, error-free output, or fitness for a particular business,
            accounting, tax, or compliance purpose. We are not responsible for indirect,
            consequential, or special losses arising from use of the service.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions about these terms can be raised with the StoreStock administrator or support
            contact provided for your workspace.
          </p>
        </article>
        <p className="legal-footer">
          Powered by{" "}
          <a href="https://www.bracketdex.com/" target="_blank" rel="noreferrer">
            BracketDex
          </a>
        </p>
      </div>
    </main>
  );
}
