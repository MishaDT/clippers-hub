"use client";

import { useMemo, useState } from "react";
import { Building2, CreditCard, ExternalLink, Landmark, Search } from "lucide-react";

export type PartnerCatalogOffer = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  provider: string | null;
  category: string | null;
  features: string[];
  licenseNumber: string | null;
  disclaimer: string | null;
  featured: boolean;
};

const categories = [
  { value: "ALL", label: "Все", icon: Landmark },
  { value: "DEBIT_CARD", label: "Дебетовые", icon: CreditCard },
  { value: "CREDIT_CARD", label: "Кредитные", icon: CreditCard },
  { value: "BUSINESS_ACCOUNT", label: "РКО", icon: Building2 }
] as const;

const categoryNames: Record<string, string> = {
  DEBIT_CARD: "Дебетовая карта",
  CREDIT_CARD: "Кредитная карта",
  BUSINESS_ACCOUNT: "РКО для бизнеса"
};

export function PartnerCatalog({ offers }: { offers: PartnerCatalogOffer[] }) {
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru-RU");
    return offers.filter((offer) => {
      if (category !== "ALL" && offer.category !== category) return false;
      if (!needle) return true;
      return `${offer.title} ${offer.provider || ""} ${offer.description}`.toLocaleLowerCase("ru-RU").includes(needle);
    });
  }, [category, offers, query]);
  const visible = filtered.slice(0, limit);

  return (
    <section className="partner-catalog">
      <header className="partner-catalog-head">
        <div>
          <span>Предложения партнёров</span>
          <h2>Выберите подходящий продукт</h2>
          <p>В каталоге только карточки, которые включены администратором ReelPay.</p>
        </div>
        <label className="partner-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setLimit(12); }}
            placeholder="Банк или название продукта"
            aria-label="Поиск партнёрского предложения"
          />
        </label>
      </header>

      <nav className="partner-category-tabs" aria-label="Категории предложений">
        {categories.map((item) => {
          const Icon = item.icon;
          const count = item.value === "ALL" ? offers.length : offers.filter((offer) => offer.category === item.value).length;
          return (
            <button
              className={category === item.value ? "active" : ""}
              type="button"
              onClick={() => { setCategory(item.value); setLimit(12); }}
              key={item.value}
            >
              <Icon size={15} /><span>{item.label}</span><em>{count}</em>
            </button>
          );
        })}
      </nav>

      {visible.length ? (
        <div className="partner-product-grid">
          {visible.map((offer) => (
            <article className={`partner-product-card ${offer.featured ? "featured" : ""}`} key={offer.id}>
              <header>
                <span className="partner-product-logo">
                  {offer.imageUrl ? <img src={offer.imageUrl} alt="" loading="lazy" /> : <Landmark size={26} />}
                </span>
                <div>
                  <small>{categoryNames[offer.category || ""] || "Предложение партнёра"}</small>
                  <em>Реклама</em>
                </div>
              </header>
              <div className="partner-product-copy">
                <span>{offer.provider || "Партнёр"}</span>
                <h3>{offer.title}</h3>
                <ul>
                  {(offer.features.length ? offer.features : [offer.description]).slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
              <footer>
                <a href={offer.url} target="_blank" rel="noopener noreferrer sponsored nofollow">
                  Оформить <ExternalLink size={15} />
                </a>
                <details>
                  <summary>Условия и лицензия</summary>
                  <p>{offer.licenseNumber || "Информация о лицензии указана на странице партнёра."}</p>
                  {offer.disclaimer ? <p>{offer.disclaimer}</p> : null}
                </details>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="partner-catalog-empty"><Search size={24} /><strong>Ничего не найдено</strong><span>Попробуйте изменить категорию или запрос.</span></div>
      )}

      {visible.length < filtered.length ? (
        <button className="partner-load-more" type="button" onClick={() => setLimit((value) => value + 12)}>
          Показать ещё {Math.min(12, filtered.length - visible.length)}
        </button>
      ) : null}
    </section>
  );
}
