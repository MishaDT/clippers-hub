import { BarChart3, Boxes, ChevronDown, Download, Gift, Link2, PackagePlus, RefreshCw, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { adminImportPampaduCatalogAction, adminSaveStoreOfferAction, adminSetStoreOfferActiveAction, adminUpdateRedemptionAction } from "@/app/admin/store/actions";

export const dynamic = "force-dynamic";

const kindLabels: Record<string, string> = {
  RP_REWARD: "Награда за RP",
  PARTNER_LINK: "Партнёрская ссылка",
  PAMPADU_WIDGET: "Витрина Pampadu"
};

function OfferFields({
  offer
}: {
  offer?: {
    id: string;
    kind: string;
    category: string | null;
    provider: string | null;
    title: string;
    description: string;
    url: string | null;
    imageUrl: string | null;
    qrImageUrl: string | null;
    priceRp: number;
    stock: number | null;
    sortOrder: number;
    active: boolean;
    featured: boolean;
  };
}) {
  return (
    <form className="admin-store-form" action={adminSaveStoreOfferAction}>
      {offer ? <input type="hidden" name="id" value={offer.id} /> : null}

      <label>
        <span>Тип предложения</span>
        <select name="kind" defaultValue={offer?.kind || "RP_REWARD"}>
          <option value="RP_REWARD">Награда за RP</option>
          <option value="PARTNER_LINK">Партнёрская ссылка</option>
          <option value="PAMPADU_WIDGET">Витрина Pampadu</option>
        </select>
      </label>
      <label>
        <span>Категория</span>
        <select name="category" defaultValue={offer?.category || ""}>
          <option value="">Без категории</option>
          <option value="DEBIT_CARD">Дебетовая карта</option>
          <option value="CREDIT_CARD">Кредитная карта</option>
          <option value="BUSINESS_ACCOUNT">РКО для бизнеса</option>
          <option value="OTHER">Другое</option>
        </select>
      </label>
      <label>
        <span>Банк или партнёр</span>
        <input name="provider" defaultValue={offer?.provider || ""} placeholder="Например, Т-Банк" />
      </label>
      <label className="wide">
        <span>Ссылка</span>
        <input name="url" type="url" defaultValue={offer?.url || ""} placeholder="https://… — данные подтянутся автоматически" />
      </label>
      <label>
        <span>Название</span>
        <input name="title" defaultValue={offer?.title || ""} placeholder="Можно оставить пустым" />
      </label>
      <label className="wide">
        <span>Описание</span>
        <textarea name="description" rows={3} defaultValue={offer?.description || ""} placeholder="Коротко опишите предложение" />
      </label>

      <div className="admin-store-number-grid wide">
        <label><span>Цена RP</span><input name="priceRp" type="number" min="0" defaultValue={offer?.priceRp ?? 0} /></label>
        <label><span>Остаток</span><input name="stock" type="number" min="0" defaultValue={offer?.stock ?? ""} placeholder="Без лимита" /></label>
        <label><span>Порядок</span><input name="sortOrder" type="number" defaultValue={offer?.sortOrder ?? 0} /></label>
      </div>

      <label className="wide">
        <span>Картинка по URL</span>
        <input name="imageUrl" type="url" defaultValue={offer?.imageUrl?.startsWith("http") ? offer.imageUrl : ""} placeholder="https://…" />
      </label>
      <label className="admin-file-field">
        <span>Загрузить картинку</span>
        <input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" />
      </label>
      <label className="admin-file-field">
        <span>Свой QR, если нужен</span>
        <input name="qrFile" type="file" accept="image/png,image/jpeg,image/webp" />
      </label>

      <div className="admin-store-switches wide">
        <label className="check"><input name="active" type="checkbox" defaultChecked={offer?.active ?? true} /><span>Показывать в магазине</span></label>
        <label className="check"><input name="featured" type="checkbox" defaultChecked={offer?.featured ?? false} /><span>Рекомендуемое</span></label>
      </div>
      <button className="btn btn-primary admin-store-save wide" type="submit">{offer ? "Сохранить изменения" : "Добавить предложение"}</button>
    </form>
  );
}

export default async function AdminStorePage({
  searchParams
}: {
  searchParams: Promise<{ imported?: string; importError?: string; saved?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const [offers, redemptions] = await Promise.all([
    prisma.storeOffer.findMany({ orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }] }),
    prisma.storeRedemption.findMany({
      include: { user: { select: { name: true, email: true } }, offer: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);
  const activeCount = offers.filter((offer) => offer.active).length;
  const pendingCount = redemptions.filter((item) => item.status === "NEW" || item.status === "CONFIRMED").length;
  const importedCount = offers.filter((offer) => offer.source === "PAMPADU").length;

  return (
    <AdminShell>
      <main className="admin-screen admin-store-screen">
        <AdminPageHeader
          eyebrow="Магазин ReelPay"
          title="Витрина и награды"
          description="Добавляйте товары за RP и партнёрские ссылки. Название, описание, картинка и QR могут сформироваться автоматически."
          action={<Link className="btn btn-primary" href="/admin/store/analytics"><BarChart3 size={16} /> Статистика переходов</Link>}
        />

        {params.imported ? <p className="admin-store-alert good">Импортировано и обновлено предложений: {params.imported}.</p> : null}
        {params.importError ? <p className="admin-store-alert bad">Не удалось получить предложения Pampadu. Попробуйте обновить каталог позже.</p> : null}

        <section className="admin-store-summary" aria-label="Сводка магазина">
          <Card><Boxes size={19} /><span><b>{offers.length}</b><small>всего предложений</small></span></Card>
          <Card><Gift size={19} /><span><b>{activeCount}</b><small>показываются сейчас</small></span></Card>
          <Card><ShoppingBag size={19} /><span><b>{pendingCount}</b><small>заявок требуют внимания</small></span></Card>
        </section>

        <Card className="admin-store-import">
          <span className="admin-store-summary-icon"><Download size={20} /></span>
          <div>
            <small>Автоматический импорт</small>
            <strong>Каталог Pampadu</strong>
            <p>Загрузит дебетовые и кредитные карты, а также РКО. Скрытые вами карточки не включатся обратно.</p>
          </div>
          <em>{importedCount} в базе</em>
          <form action={adminImportPampaduCatalogAction}>
            <button className="btn btn-primary" type="submit"><RefreshCw size={16} /> Обновить каталог</button>
          </form>
        </Card>

        <details className="admin-store-card admin-store-create">
          <summary>
            <span className="admin-store-summary-icon"><PackagePlus size={20} /></span>
            <span><small>Новое предложение</small><strong>Добавить товар или партнёрскую ссылку</strong></span>
            <ChevronDown size={19} />
          </summary>
          <div className="admin-store-card-body"><OfferFields /></div>
        </details>

        <section className="admin-store-section-head">
          <div><small>Каталог</small><h2>Предложения магазина</h2></div>
          <span>{offers.length} шт.</span>
        </section>

        <section className="admin-store-list">
          {offers.map((offer) => {
            const editing = params.edit === offer.id;
            return (
            <article className={`admin-store-card admin-store-offer ${editing ? "is-editing" : ""}`} id={`offer-${offer.id}`} key={offer.id}>
              <div className="admin-store-offer-row">
                <span className="admin-store-summary-icon">{offer.kind === "RP_REWARD" ? <Gift size={19} /> : <Link2 size={19} />}</span>
                <span className="admin-store-offer-copy">
                  <small>{offer.source === "PAMPADU" ? "Pampadu" : kindLabels[offer.kind] || offer.kind}{offer.category ? ` · ${offer.category}` : ""}</small>
                  <strong>{offer.title}</strong>
                  <em>{offer.priceRp ? `${offer.priceRp} RP` : "Партнёрское предложение"}{offer.stock !== null ? ` · остаток ${offer.stock}` : ""}</em>
                </span>
                <span className={`admin-store-state ${offer.active ? "active" : ""}`}>{offer.active ? "Активно" : "Скрыто"}</span>
                <Link className="admin-store-edit-link" href={editing ? "/admin/store" : `/admin/store?edit=${offer.id}#offer-${offer.id}`}>
                  {editing ? "Закрыть" : "Изменить"}
                </Link>
              </div>
              {editing ? <div className="admin-store-card-body">
                <p className="admin-store-description">{offer.description}</p>
                <OfferFields offer={offer} />
                <form className="admin-store-visibility" action={adminSetStoreOfferActiveAction}>
                  <input type="hidden" name="id" value={offer.id} />
                  <input type="hidden" name="active" value={offer.active ? "0" : "1"} />
                  <button className="btn btn-small btn-ghost" type="submit">{offer.active ? "Скрыть из магазина" : "Показывать в магазине"}</button>
                </form>
              </div> : null}
            </article>
          )})}
        </section>

        <Card className="admin-panel admin-store-orders">
          <div className="admin-store-section-head">
            <div><small>Покупки</small><h2><ShoppingBag size={18} /> Заявки за RP</h2></div>
            <span>{redemptions.length}</span>
          </div>
          <div className="admin-store-redemptions">
            {redemptions.length ? redemptions.map((item) => (
              <article key={item.id}>
                <div><strong>{item.offer.title}</strong><span>{item.user.name} · {item.user.email}</span><small>{item.createdAt.toLocaleString("ru-RU")} · {item.costRp} RP</small></div>
                <form action={adminUpdateRedemptionAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <select name="status" defaultValue={item.status}><option value="NEW">Новая</option><option value="CONFIRMED">Подтверждена</option><option value="FULFILLED">Выполнена</option><option value="CANCELLED">Отменена + возврат</option></select>
                  <input name="adminNote" defaultValue={item.adminNote || ""} placeholder="Комментарий" />
                  <button type="submit">Сохранить</button>
                </form>
              </article>
            )) : <div className="admin-store-empty"><ShoppingBag size={24} /><strong>Заявок пока нет</strong><span>Новые покупки за RP появятся здесь.</span></div>}
          </div>
        </Card>
      </main>
    </AdminShell>
  );
}
