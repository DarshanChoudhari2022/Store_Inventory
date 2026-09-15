"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Package,
  Store,
  ChartNoAxesCombined,
  ClipboardCheck,
  ShieldCheck,
  Bell,
  Check,
  Search,
  LayoutDashboard,
  CircleHelp,
  CircleCheck,
  TrendingUp,
  Download,
  Languages,
  SlidersHorizontal,
  WifiOff,
  WalletCards,
} from "lucide-react";
import { AnimatedLink, Reveal } from "./Motion";
import "./landing.css";

type Lang = "en" | "mr";
export default function LandingPage({
  lang,
  languageToggle,
  children,
}: {
  lang: Lang;
  languageToggle: ReactNode;
  children: ReactNode;
}) {
  void children;
  const mr = lang === "mr";
  const t = (en: string, marathi: string) => (mr ? marathi : en);
  const [preview, setPreview] = useState<"inventory" | "sales" | "closing">(
    "inventory",
  );
  const features = [
    {
      icon: Package,
      title: t("Every item. Accounted for.", "प्रत्येक वस्तूचा हिशोब."),
      copy: t(
        "Add your own products, set buying and selling prices, and update quantities. Search, filter, and edit your catalog in one place.",
        "उत्पादने जोडा, खरेदी-विक्री किंमत ठरवा आणि संख्या अपडेट करा. एकाच ठिकाणी शोधा, फिल्टर करा आणि बदल करा.",
      ),
      tag: t("Inventory control", "स्टॉक व्यवस्थापन"),
    },
    {
      icon: ChartNoAxesCombined,
      title: t("See what your day earned.", "दिवसभराची कमाई पाहा."),
      copy: t(
        "Record each sale with its quantity and selling price. Stock adjusts automatically, with revenue and profit calculated for you.",
        "प्रत्येक विक्रीची संख्या आणि किंमत नोंदवा. स्टॉक आपोआप कमी होतो आणि विक्री व नफा मोजला जातो.",
      ),
      tag: t("Sales & profit", "विक्री आणि नफा"),
    },
    {
      icon: Bell,
      title: t("Restock before you run out.", "संपण्याआधी साठा भरा."),
      copy: t(
        "Set a reorder level for each product. Low-stock and out-of-stock filters help you build a focused restock list.",
        "प्रत्येक वस्तूसाठी किमान साठा ठरवा. कमी आणि संपलेला स्टॉक फिल्टर करून रीस्टॉक यादी पाहा.",
      ),
      tag: t("Low-stock alerts", "कमी स्टॉक सूचना"),
    },
    {
      icon: ClipboardCheck,
      title: t("Close the day with clarity.", "दिवसाचा स्पष्ट हिशोब."),
      copy: t(
        "Check sales, profit, units sold, and stock value. Update counted quantities and download a CSV report for your records.",
        "विक्री, नफा, विकलेली संख्या आणि स्टॉक मूल्य पाहा. मोजलेला स्टॉक अपडेट करा आणि CSV अहवाल डाउनलोड करा.",
      ),
      tag: t("Daily closing", "दैनिक हिशोब"),
    },
    {
      icon: Store,
      title: t("Many shops. One clear view.", "अनेक दुकाने. एक स्पष्ट दृश्य."),
      copy: t(
        "Owners can create shop accounts, switch between stores, and see combined totals. Each shop gets its own inventory and login.",
        "मालक दुकान खाती तयार करू शकतात, दुकान बदलू शकतात आणि एकूण हिशोब पाहू शकतात. प्रत्येक दुकानाचा स्वतंत्र स्टॉक आणि लॉगिन.",
      ),
      tag: t("Multi-store management", "अनेक दुकानांचे व्यवस्थापन"),
    },
    {
      icon: ShieldCheck,
      title: t("The right access for everyone.", "प्रत्येकासाठी योग्य प्रवेश."),
      copy: t(
        "Separate owner and shop access keeps work organized. Generate credentials, reset shop passwords, and work in English or Marathi.",
        "मालक आणि दुकानांसाठी स्वतंत्र प्रवेश. लॉगिन तयार करा, पासवर्ड रीसेट करा आणि इंग्रजी किंवा मराठीत काम करा.",
      ),
      tag: t("Access & languages", "प्रवेश आणि भाषा"),
    },
    {
      icon: WifiOff,
      title: t("Keep selling when the signal drops.", "नेट गेले तरी विक्री सुरू."),
      copy: t(
        "Your workspace and pending bills stay on the device. When the connection returns, each sale syncs safely without duplicates.",
        "वर्कस्पेस आणि प्रलंबित बिले डिव्हाइसवर राहतात. कनेक्शन परतल्यावर प्रत्येक विक्री सुरक्षितपणे समक्रमित होते.",
      ),
      tag: t("Offline recovery", "ऑफलाइन पुनर्प्राप्ती"),
    },
    {
      icon: WalletCards,
      title: t("Keep credit and purchases together.", "उधारी आणि खरेदी एकत्र."),
      copy: t(
        "Track customer balances, supplier dues, expenses, returns, and cash closing in the same daily workspace.",
        "ग्राहक शिल्लक, पुरवठादार देणी, खर्च, परतावा आणि रोकड बंद करणे एकाच जागी पाहा.",
      ),
      tag: t("Daily accounts", "दैनंदिन हिशोब"),
    },
  ];
  return (
    <main className="lp" lang={lang}>
      <a className="lp-skip" href="#features">
        {t("Skip to features", "वैशिष्ट्यांकडे जा")}
      </a>
      <header className="lp-nav lp-container">
        <a
          href="#"
          className="lp-brand"
          aria-label={t(
            "Store Inventory Management home",
            "स्टोअर इन्व्हेंटरी मुख्यपृष्ठ",
          )}
        >
          <span className="lp-logo">
            <Package size={23} />
          </span>
          <span>
            Store<span className="lp-brand-light">Stock</span>
            <small>{t("INVENTORY MANAGEMENT", "स्टॉक व्यवस्थापन")}</small>
          </span>
        </a>
        <nav aria-label={t("Main navigation", "मुख्य नेव्हिगेशन")}>
          <AnimatedLink href="#features">
            {t("Features", "वैशिष्ट्ये")}
          </AnimatedLink>
          <AnimatedLink href="#how-it-works">
            {t("How it works", "कसे काम करते")}
          </AnimatedLink>
          <AnimatedLink href="#preview">
            {t("Product preview", "प्रिव्ह्यू")}
          </AnimatedLink>
        </nav>
        <div className="lp-nav-actions">
          {languageToggle}
          <AnimatedLink href="/login" className="lp-nav-login">
            {t("Sign in", "लॉगिन")} <ArrowUpRight size={17} />
          </AnimatedLink>
        </div>
      </header>

      <section className="lp-hero lp-container">
        <Reveal className="lp-hero-copy">
          <span className="lp-eyebrow">
            <span className="lp-dot" />
            {t("SMALL SHOPS. BIG POSSIBILITIES.", "छोटी दुकाने. मोठ्या संधी.")}
          </span>
          <h1>
            {t("Less counting.", "कमी मोजणी.")}
            <br />
            {t("More ", "अधिक ")}
            <span className="lp-serif">{t("growing.", "प्रगती.")}</span>
            <span className="lp-title-star" aria-hidden>
              ✳
            </span>
          </h1>
          <p>
            {t(
              "Your stock, sales, and daily closing. Finally together. A calmer way to run your kirana, tapri, or retail store—and keep every shop in sync.",
              "स्टॉक, विक्री आणि दिवसाचा हिशोब एकाच ठिकाणी. किराणा, टपरी किंवा रिटेल दुकानाचे काम सोपे करा आणि प्रत्येक दुकानाचा हिशोब व्यवस्थित ठेवा.",
            )}
          </p>
          <div className="lp-hero-actions">
            <AnimatedLink href="/login">
              {t("Open your store", "तुमचे दुकान उघडा")}
              <ArrowUpRight size={19} />
            </AnimatedLink>
            <AnimatedLink href="#preview">
              {t("Take a closer look", "जवळून पाहा")}
              <ArrowRight size={17} />
            </AnimatedLink>
          </div>
          <div className="lp-hero-notes">
            <span>
              <Check size={15} />
              {t("Owner & shop access", "मालक व दुकान प्रवेश")}
            </span>
            <span>
              <Check size={15} />
              {t("English + मराठी", "मराठी + English")}
            </span>
          </div>
        </Reveal>
        <Reveal className="lp-hero-visual" delay={0.12}>
          <div className="lp-orbit" aria-hidden />
          <div className="lp-mini-report">
            <span className="lp-icon-square">
              <TrendingUp size={19} />
            </span>
            <div>
              <small>{t("Today’s profit", "आजचा नफा")}</small>
              <strong>
                ₹2,480 <span>↗</span>
              </strong>
            </div>
            <span className="lp-example">{t("Example", "उदाहरण")}</span>
          </div>
          <div className="lp-mini-dashboard">
            <div className="lp-mini-top">
              <span>
                <Store size={17} />
                {t("My neighbourhood store", "माझे दुकान")}
              </span>
              <span className="lp-avatar">S</span>
            </div>
            <div className="lp-mini-heading">
              <div>
                <small>
                  {t("LET’S MAKE TODAY COUNT", "आजचा दिवस खास बनवा")}
                </small>
                <h2>{t("A little more in control.", "काम आता नियंत्रणात.")}</h2>
              </div>
              <span className="lp-live">
                <span className="lp-dot" />
                {t("Overview", "आढावा")}
              </span>
            </div>
            <div className="lp-mini-kpis">
              <div>
                <span>{t("Today’s sales", "आजची विक्री")}</span>
                <strong>₹12,850</strong>
                <small>{t("Across 48 transactions", "४८ व्यवहार")}</small>
              </div>
              <div>
                <span>{t("Items in stock", "स्टॉकमधील वस्तू")}</span>
                <strong>1,284</strong>
                <small>{t("Across 86 products", "८६ उत्पादने")}</small>
              </div>
            </div>
            <div className="lp-chart-title">
              <strong>{t("Sales at a glance", "विक्रीचा आढावा")}</strong>
              <small>{t("Illustrative sales", "विक्रीचे उदाहरण")}</small>
            </div>
            <div
              className="lp-bars"
              aria-label={t(
                "Illustrative sales chart",
                "विक्रीचा उदाहरण चार्ट",
              )}
            >
              {[38, 58, 43, 78, 62, 88, 70, 96, 82, 66, 91, 100].map(
                (height, i) => (
                  <span
                    key={i}
                    style={{
                      height: `${height}%`,
                      animationDelay: `${i * 0.055}s`,
                    }}
                  />
                ),
              )}
            </div>
            <div className="lp-chart-labels">
              <span>9 AM</span>
              <span>12 PM</span>
              <span>3 PM</span>
              <span>6 PM</span>
            </div>
            <div className="lp-mini-bottom">
              <CircleCheck size={16} />
              {t(
                "Every sale updates your stock.",
                "प्रत्येक विक्रीनंतर स्टॉक अपडेट होतो.",
              )}
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="lp-stock-alert">
            <span className="lp-alert-icon">
              <Package size={20} />
            </span>
            <div>
              <strong>
                {t("A heads-up, before it’s gone.", "संपण्याआधी सूचना.")}
              </strong>
              <small>
                {t(
                  "3 products are ready for restock",
                  "३ उत्पादनांचा साठा भरण्याची वेळ",
                )}
              </small>
            </div>
            <span className="lp-alert-dot" />
          </div>
        </Reveal>
      </section>
      <div className="lp-audience lp-container">
        <span>{t("MADE FOR YOUR EVERYDAY", "रोजच्या कामासाठी")}</span>
        <strong>
          <Store size={19} />
          {t("Kirana stores", "किराणा दुकाने")}
        </strong>
        <strong>
          <Package size={19} />
          {t("Tapri & general stores", "टपरी आणि जनरल स्टोअर्स")}
        </strong>
        <strong>
          <LayoutDashboard size={19} />
          {t("Small retail teams", "लहान रिटेल टीम")}
        </strong>
        <strong>
          <Languages size={19} />
          {t("Local language. Less friction.", "आपली भाषा. सोपे काम.")}
        </strong>
      </div>

      <section id="features" className="lp-features lp-container">
        <Reveal className="lp-section-heading">
          <div>
            <span className="lp-eyebrow">
              {t("A PLACE FOR EVERYTHING", "सगळ्यासाठी एक जागा")}
            </span>
            <h2>
              {t("All the essentials.", "सर्व आवश्यक गोष्टी.")}
              <br />
              <span className="lp-serif">
                {t("None of the overwhelm.", "कामाचा ताण कमी.")}
              </span>
            </h2>
          </div>
          <p>
            {t(
              "From the first sale to the last stock count, give your daily routine a simpler home.",
              "पहिल्या विक्रीपासून शेवटच्या स्टॉक मोजणीपर्यंत, रोजच्या कामाला सोपा आधार.",
            )}
          </p>
        </Reveal>
        <div className="lp-feature-grid">
          {features.map((f, i) => (
            <Reveal
              key={f.tag}
              delay={(i % 3) * 0.06}
              className={`lp-feature-card lp-feature-${i}`}
            >
              <div className="lp-feature-top">
                <span className="lp-feature-icon">
                  <f.icon size={23} />
                </span>
                <span className="lp-feature-number">0{i + 1}</span>
              </div>
              <span className="lp-feature-tag">{f.tag}</span>
              <h3>{f.title}</h3>
              <p>{f.copy}</p>
              {i === 0 && (
                <div className="lp-stock-meter">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              )}
              {i === 1 && (
                <div className="lp-profit-equation">
                  <span>{t("Sales", "विक्री")}</span>
                  <span>−</span>
                  <span>{t("Cost", "खर्च")}</span>
                  <span>=</span>
                  <strong>{t("Your profit", "तुमचा नफा")} ↗</strong>
                </div>
              )}
              {i === 2 && (
                <div className="lp-alert-pill">
                  <span />
                  {t("Low stock? You’ll see it here.", "कमी स्टॉक इथे दिसेल.")}
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </section>

      <section id="preview" className="lp-preview-section">
        <div className="lp-container">
          <Reveal className="lp-centered">
            <span className="lp-eyebrow">
              {t("MEET YOUR NEW DAILY DESK", "तुमचा नवा डेली डेस्क")}
            </span>
            <h2>
              {t("A clear view. ", "स्पष्ट दृश्य. ")}
              <span className="lp-serif">
                {t("A better day.", "चांगला दिवस.")}
              </span>
            </h2>
            <p>
              {t(
                "Explore an example of your workspace. Your real store data stays behind your login.",
                "कार्यस्थळाचे उदाहरण पाहा. तुमच्या दुकानाची खरी माहिती लॉगिननंतरच दिसते.",
              )}
            </p>
          </Reveal>
          <Reveal className="lp-product">
            <aside>
              <div className="lp-product-brand">
                <Package size={23} /> StoreStock
              </div>
              <small>{t("WORKSPACE PREVIEW", "कार्यस्थळ प्रिव्ह्यू")}</small>
              {(["inventory", "sales", "closing"] as const).map((tab, i) => {
                const Icon = [Package, ChartNoAxesCombined, ClipboardCheck][i];
                return (
                  <button
                    key={tab}
                    onClick={() => setPreview(tab)}
                    className={preview === tab ? "selected" : ""}
                    aria-pressed={preview === tab}
                  >
                    <Icon size={18} />
                    {
                      [
                        t("Inventory", "स्टॉक"),
                        t("Sales", "विक्री"),
                        t("Daily closing", "दैनिक हिशोब"),
                      ][i]
                    }
                  </button>
                );
              })}
              <span className="lp-product-help">
                <CircleHelp size={16} />
                {t("Example data only", "फक्त उदाहरण माहिती")}
              </span>
            </aside>
            <div className="lp-product-main" aria-live="polite">
              <div className="lp-product-header">
                <h3>
                  {preview === "inventory"
                    ? t("Your inventory", "तुमचा स्टॉक")
                    : preview === "sales"
                      ? t("Today’s sales", "आजची विक्री")
                      : t("Daily closing", "दैनिक हिशोब")}
                </h3>
                <span className="lp-sample-tag">
                  {t("Sample store", "नमुना दुकान")}
                </span>
              </div>
              <div className="lp-product-stats">
                {[
                  [t("Sales today", "आजची विक्री"), "₹12,850"],
                  [t("Profit today", "आजचा नफा"), "₹2,480"],
                  [t("Low stock", "कमी स्टॉक"), "3"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              {preview === "inventory" ? (
                <>
                  <div className="lp-mock-toolbar">
                    <span>
                      <Search size={16} />
                      {t("Your everyday essentials", "रोजच्या आवश्यक वस्तू")}
                    </span>
                    <SlidersHorizontal size={17} />
                  </div>
                  <div className="lp-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {[
                            t("Product", "उत्पादन"),
                            t("Category", "वर्ग"),
                            t("Stock", "स्टॉक"),
                            t("Price", "किंमत"),
                            t("Status", "स्थिती"),
                          ].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            t("Amul milk · 500 ml", "अमूल दूध · ५०० मिली"),
                            t("Dairy", "दुग्धजन्य"),
                            "42",
                            "₹28",
                            false,
                          ],
                          [
                            t("Parle-G · 250 g", "पार्ले-जी · २५० ग्रॅम"),
                            t("Biscuits", "बिस्किटे"),
                            "64",
                            "₹25",
                            false,
                          ],
                          [
                            t("Tata salt · 1 kg", "टाटा मीठ · १ किलो"),
                            t("Grocery", "किराणा"),
                            "4",
                            "₹28",
                            true,
                          ],
                          [
                            t("Maggi · 70 g", "मॅगी · ७० ग्रॅम"),
                            t("Packaged food", "पॅकेज्ड फूड"),
                            "38",
                            "₹14",
                            false,
                          ],
                        ].map(([name, cat, qty, price, low]) => (
                          <tr key={String(name)}>
                            <td>
                              <span className="lp-product-icon">
                                <Package size={16} />
                              </span>
                              {name}
                            </td>
                            <td>{cat}</td>
                            <td>{qty}</td>
                            <td>{price}</td>
                            <td>
                              <span
                                className={low ? "lp-badge low" : "lp-badge"}
                              >
                                {low
                                  ? t("Low stock", "कमी स्टॉक")
                                  : t("In stock", "उपलब्ध")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : preview === "sales" ? (
                <div className="lp-preview-detail">
                  <ChartNoAxesCombined size={30} />
                  <h4>
                    {t("Every sale has a story.", "प्रत्येक विक्रीचा हिशोब.")}
                  </h4>
                  <p>
                    {t(
                      "48 transactions · ₹12,850 revenue · ₹2,480 profit",
                      "४८ व्यवहार · ₹१२,८५० विक्री · ₹२,४८० नफा",
                    )}
                  </p>
                  <div>
                    <span>{t("Milk × 2", "दूध × २")}</span>
                    <strong>₹56</strong>
                  </div>
                  <div>
                    <span>{t("Biscuits × 4", "बिस्किटे × ४")}</span>
                    <strong>₹100</strong>
                  </div>
                </div>
              ) : (
                <div className="lp-preview-detail">
                  <ClipboardCheck size={30} />
                  <h4>{t("Everything adds up.", "सगळ्याचा हिशोब एकत्र.")}</h4>
                  <p>
                    {t(
                      "Review totals, count what’s left, and keep a report of your day.",
                      "एकूण हिशोब पाहा, उरलेला स्टॉक मोजा आणि दिवसाचा अहवाल ठेवा.",
                    )}
                  </p>
                  <div>
                    <span>{t("Stock value", "स्टॉक मूल्य")}</span>
                    <strong>₹38,420</strong>
                  </div>
                  <div>
                    <span>
                      <Download size={16} />
                      {t(
                        "CSV reports available after sign-in",
                        "लॉगिननंतर CSV अहवाल उपलब्ध",
                      )}
                    </span>
                    <Check size={17} />
                  </div>
                </div>
              )}
              <div className="lp-product-footer">
                <ShieldCheck size={14} />
                {t(
                  "Separate inventory for every shop",
                  "प्रत्येक दुकानासाठी स्वतंत्र स्टॉक",
                )}
                <span>{t("Illustrative preview", "उदाहरण प्रिव्ह्यू")}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="how-it-works" className="lp-how lp-container">
        <Reveal className="lp-centered">
          <span className="lp-eyebrow">
            {t("A SIMPLE DAILY RHYTHM", "रोजच्या कामाची सोपी पद्धत")}
          </span>
          <h2>
            {t("Open. Sell. ", "दुकान उघडा. विक्री करा. ")}
            <span className="lp-serif">
              {t("Close with confidence.", "निश्चिंत हिशोब करा.")}
            </span>
          </h2>
        </Reveal>
        <div className="lp-steps">
          {[
            [
              t("Make it your store", "तुमचे दुकान तयार करा"),
              t(
                "Sign in with your owner or shop account. Add the products you actually sell.",
                "मालक किंवा दुकान खात्याने लॉगिन करा. विक्रीची उत्पादने जोडा.",
              ),
            ],
            [
              t("Keep the day moving", "दिवसाचे काम सुरू ठेवा"),
              t(
                "Record sales, check available stock, and spot what needs replenishing.",
                "विक्री नोंदवा, उपलब्ध स्टॉक पाहा आणि कमी साठा ओळखा.",
              ),
            ],
            [
              t("Finish with the full picture", "संपूर्ण हिशोबासह दिवस संपवा"),
              t(
                "Count remaining stock, review profit, and export your daily report.",
                "उरलेला स्टॉक मोजा, नफा पाहा आणि दैनिक अहवाल डाउनलोड करा.",
              ),
            ],
          ].map(([title, copy], i) => (
            <Reveal className="lp-step" key={title} delay={i * 0.08}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="access" className="lp-access lp-container">
        <Reveal className="lp-access-copy">
          <span className="lp-eyebrow">
            {t("YOUR STORE STARTS HERE", "तुमच्या दुकानाची सुरुवात इथे")}
          </span>
          <h2>
            {t("Good days start", "चांगल्या दिवसाची सुरुवात")}
            <br />
            {t("with a ", "एका ")}
            <span className="lp-serif">
              {t("clear desk.", "स्पष्ट हिशोबाने.")}
            </span>
          </h2>
          <p>
            {t(
              "Step into your workspace. Your products, your people, and your next good day—all in one place.",
              "तुमच्या कार्यस्थळात प्रवेश करा. तुमची उत्पादने, तुमची टीम आणि पुढचा चांगला दिवस—सगळे एकाच ठिकाणी.",
            )}
          </p>
          <div>
            <ShieldCheck size={19} />
            {t(
              "Separate owner and shop credentials",
              "मालक आणि दुकानासाठी स्वतंत्र लॉगिन",
            )}
          </div>
          <div>
            <Languages size={19} />
            {t(
              "Work in the language you’re comfortable with",
              "तुमच्या सोयीच्या भाषेत काम करा",
            )}
          </div>
        </Reveal>
        <Reveal className="lp-login-wrap"><AnimatedLink href="/login" className="lp-access-cta">Open your workspace <ArrowRight size={18}/></AnimatedLink></Reveal>
      </section>
      <footer className="lp-footer lp-container">
        <span className="lp-footer-brand">
          <Package size={19} /> StoreStock{" "}
          <small>
            {t(
              "A little order. A lot of possibility.",
              "सुव्यवस्थित काम. अनेक संधी.",
            )}
          </small>
        </span>
        <span>
          {t(
            "Retail operations, made clear.",
            "किरकोळ व्यवसायासाठी स्पष्ट आणि सोपे काम.",
          )}
        </span>
        <span className="lp-powered">
          Powered by{" "}
          <a href="https://www.bracketdex.com/" target="_blank" rel="noreferrer">
            BracketDex
          </a>
        </span>
        <span className="lp-legal-links">
          <a href="/terms-of-service">Terms</a>
          <a href="/privacy-policy">Privacy</a>
        </span>
        <AnimatedLink href="#">{t("Back to top", "वर जा")} ↑</AnimatedLink>
      </footer>
    </main>
  );
}
