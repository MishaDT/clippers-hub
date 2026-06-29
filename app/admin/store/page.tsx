import { PackagePlus, ShoppingBag } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { adminSaveStoreOfferAction, adminSetStoreOfferActiveAction, adminUpdateRedemptionAction } from "@/app/admin/store/actions";

export const dynamic = "force-dynamic";

export default async function AdminStorePage() {
  const [offers, redemptions] = await Promise.all([
    prisma.storeOffer.findMany({ orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }] }),
    prisma.storeRedemption.findMany({
      include: { user: { select: { name: true, email: true } }, offer: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);

  return (
    <AdminShell>
      <main className="admin-screen">
        <AdminPageHeader
          eyebrow="Магазин"
          title="Витрина и награды RP"
          description="Добавляйте ссылки, товары и виджеты. Для публичной ссылки название и картинка подтянутся автоматически."
        />

        <Card className="admin-panel admin-store-editor">
          <div className="section-head compact"><h2><PackagePlus size={18} /> Новое предложение</h2></div>
          <form action={adminSaveStoreOfferAction}>
            <label>Тип<select name="kind" defaultValue="RP_REWARD"><option value="RP_REWARD">Награда за RP</option><option value="PARTNER_LINK">Партнёрская ссылка</option><option value="PAMPADU_WIDGET">Виджет Pampadu</option></select></label>
            <label className="wide">Ссылка<input name="url" type="url" placeholder="https://… — данные подтянутся автоматически" /></label>
            <label>Название<input name="title" placeholder="Можно оставить пустым" /></label>
            <label className="wide">Описание<textarea name="description" rows={3} placeholder="Можно оставить пустым" /></label>
            <label>Цена RP<input name="priceRp" type="number" min="0" defaultValue="0" /></label>
            <label>Остаток<input name="stock" type="number" min="0" placeholder="Пусто = без лимита" /></label>
            <label>Порядок<input name="sortOrder" type="number" defaultValue="0" /></label>
            <label>Картинка URL<input name="imageUrl" type="url" /></label>
            <label>Загрузить картинку<input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
            <label>Свой QR<input name="qrFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
            <label className="check"><input name="active" type="checkbox" defaultChecked /> Активно</label>
            <label className="check"><input name="featured" type="checkbox" /> Рекомендуемое</label>
            <button className="btn btn-primary" type="submit">Добавить</button>
          </form>
        </Card>

        <section className="admin-store-list">
          {offers.map((offer) => (
            <Card className="admin-panel" key={offer.id}>
              <div className="admin-store-offer-head">
                <div><small>{offer.kind}</small><h2>{offer.title}</h2><p>{offer.description}</p></div>
                <Tag tone={offer.active ? "good" : "soft"}>{offer.active ? "Активно" : "Скрыто"}</Tag>
              </div>
              <form className="admin-store-edit" action={adminSaveStoreOfferAction}>
                <input type="hidden" name="id" value={offer.id} />
                <input type="hidden" name="existingImageUrl" value={offer.imageUrl || ""} />
                <input type="hidden" name="existingQrImageUrl" value={offer.qrImageUrl || ""} />
                <label>Тип<select name="kind" defaultValue={offer.kind}><option value="RP_REWARD">Награда за RP</option><option value="PARTNER_LINK">Партнёрская ссылка</option><option value="PAMPADU_WIDGET">Виджет Pampadu</option></select></label>
                <label>Название<input name="title" defaultValue={offer.title} /></label>
                <label className="wide">Ссылка<input name="url" type="url" defaultValue={offer.url || ""} /></label>
                <label className="wide">Описание<textarea name="description" rows={2} defaultValue={offer.description} /></label>
                <label>Цена RP<input name="priceRp" type="number" min="0" defaultValue={offer.priceRp} /></label>
                <label>Остаток<input name="stock" type="number" min="0" defaultValue={offer.stock ?? ""} /></label>
                <label>Порядок<input name="sortOrder" type="number" defaultValue={offer.sortOrder} /></label>
                <label>Картинка URL<input name="imageUrl" type="url" defaultValue={offer.imageUrl?.startsWith("http") ? offer.imageUrl : ""} /></label>
                <label>Новая картинка<input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
                <label>Новый QR<input name="qrFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
                <label className="check"><input name="active" type="checkbox" defaultChecked={offer.active} /> Активно</label>
                <label className="check"><input name="featured" type="checkbox" defaultChecked={offer.featured} /> Рекомендуемое</label>
                <button className="btn" type="submit">Сохранить</button>
              </form>
              <form action={adminSetStoreOfferActiveAction}>
                <input type="hidden" name="id" value={offer.id} />
                <input type="hidden" name="active" value={offer.active ? "0" : "1"} />
                <button className="btn btn-small btn-ghost" type="submit">{offer.active ? "Скрыть" : "Включить"}</button>
              </form>
            </Card>
          ))}
        </section>

        <Card className="admin-panel">
          <div className="section-head compact"><h2><ShoppingBag size={18} /> Заявки за RP</h2></div>
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
            )) : <p className="muted">Заявок пока нет.</p>}
          </div>
        </Card>
      </main>
    </AdminShell>
  );
}
