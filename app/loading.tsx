export default function Loading() {
  return (
    <div className="route-skeleton" aria-hidden="true">
      <div className="sk-topbar">
        <span className="sk-brand">ReelPay</span>
      </div>
      <div className="sk-body">
        <div className="sk-line w40" />
        <div className="sk-line w60" />
        <div className="sk-card" />
        <div className="sk-card" />
        <div className="sk-card" />
      </div>
    </div>
  );
}
