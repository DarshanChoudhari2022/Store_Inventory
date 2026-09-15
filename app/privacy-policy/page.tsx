import Link from "next/link";
import "../legal.css";

export const metadata = {
  title: "Privacy Policy | StoreStock",
  description: "Privacy Policy for StoreStock retail inventory and billing software.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <div className="legal-wrap">
        <Link href="/" className="legal-back">
          StoreStock
        </Link>
        <article className="legal-card">
          <span className="legal-kicker">StoreStock legal</span>
          <h1>Privacy Policy</h1>
          <p className="legal-meta">Last updated: September 15, 2026</p>
          <p>
            This Privacy Policy explains how StoreStock handles information used for retail shop
            inventory, billing, staff access, customers, suppliers, reports, and related workflows.
          </p>

          <h2>1. Information we process</h2>
          <p>StoreStock may process information such as:</p>
          <ul>
            <li>Shop names, locations, settings, GST details, receipt details, and operator accounts.</li>
            <li>Product catalogues, stock quantities, prices, barcodes, expiry dates, and stock movements.</li>
            <li>Invoices, returns, tenders, cash register entries, expenses, purchases, and reports.</li>
            <li>Customer and supplier names, phone numbers, addresses, GSTINs, balances, and payment records.</li>
            <li>Technical information such as session status, request timing, errors, rate limits, and device-local drafts.</li>
          </ul>

          <h2>2. How information is used</h2>
          <p>
            Information is used to provide the StoreStock workspace, authenticate users, isolate each
            shop&apos;s data, process bills and stock changes, show reports, support offline recovery, and
            maintain service security and reliability.
          </p>

          <h2>3. Device-local data</h2>
          <p>
            StoreStock may store drafts, pending bills, recent product cache, language choice, theme,
            print preferences, and receipt logo preferences on the device. This helps the app remain
            fast and recover from short network outages. Anyone with access to the device may be able
            to see locally stored business data, so shared counter devices should be protected.
          </p>

          <h2>4. Sharing and exports</h2>
          <p>
            Users may choose to print, export, download, or share invoices and reports, including
            through tools such as WhatsApp or CSV exports. Those user-initiated shares are controlled
            by the user and may be handled by third-party services outside StoreStock.
          </p>

          <h2>5. Service providers</h2>
          <p>
            StoreStock may rely on hosting, database, authentication, monitoring, storage, browser,
            and device services to operate the product. These providers process data only as needed
            to deliver, secure, and maintain the service.
          </p>

          <h2>6. Security</h2>
          <p>
            StoreStock uses role-based access, shop isolation, server-side validation, HttpOnly
            sessions, request limits, and audit-oriented records to protect operational data. No
            system is perfectly secure, so users should keep credentials private, restrict staff
            access, and report suspicious activity quickly.
          </p>

          <h2>7. Retention</h2>
          <p>
            Business records may be retained while a workspace is active and as needed for legal,
            accounting, backup, dispute, security, or operational reasons. Device-local data may
            remain until a user signs out, clears device storage, or removes browser data.
          </p>

          <h2>8. Your choices</h2>
          <p>
            Workspace administrators can manage shops, pause access, reset credentials, export
            records, and request updates or deletion where available and legally permitted. Some
            transaction records may need to be retained for accounting, audit, or abuse-prevention
            purposes.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions about privacy can be raised with the StoreStock administrator or support
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
