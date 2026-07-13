import routeLoadingLab from "@/assets/route-loading-lab.svg";
import "./RouteLoading.css";

const loadingLabel = "กำลังเตรียมสาร…";

export function RouteLoading(): JSX.Element {
  return (
    <div
      className="route-loading"
      role="status"
      aria-live="polite"
      aria-label={loadingLabel}
    >
      <div className="route-loading__visual" aria-hidden="true">
        <div className="route-loading__halo" />
        <div className="route-loading__orbit" />
        <div className="route-loading__scan" data-testid="route-loading-scan" />
        <span className="route-loading__particle route-loading__particle--one" />
        <span className="route-loading__particle route-loading__particle--two" />
        <span className="route-loading__particle route-loading__particle--three" />
        <span className="route-loading__particle route-loading__particle--four" />
        <span className="route-loading__particle route-loading__particle--five" />
      </div>

      <div className="route-loading__scene">
        <img
          className="route-loading__artwork"
          data-testid="route-loading-artwork"
          src={routeLoadingLab}
          alt=""
          aria-hidden="true"
        />
        <p className="route-loading__label">{loadingLabel}</p>
      </div>
    </div>
  );
}
