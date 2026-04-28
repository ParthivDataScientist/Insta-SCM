# Shipping Module Audit Notes

## Active shipping entry points
- `client/src/views/ShipmentDashboardPremium.jsx`
- `client/src/views/StoragePremium.jsx`
- `client/src/shipping/hooks/useShipments.js`
- `client/src/shipping/components/ShipmentTable.jsx`
- `client/src/shipping/components/ShipmentDetailPanel.jsx`
- `client/src/shipping/components/TrackModal.jsx`
- `client/src/shipping/components/ShipmentSidePanel.jsx`
- `client/src/shipping/services/shipmentApi.ts`
- `app/api/v1/endpoints/shipments.py`
- `app/services/shipment_service.py`
- `app/services/dhl.py`

## Removed as unused after import/route verification
- `client/src/views/ShipmentDashboard.jsx`
- `client/src/views/Storage.jsx`
- `client/src/components/ShipmentTable.jsx`
- `client/src/components/ShipmentDetailPanel.jsx`
- `client/src/components/ShipmentSidePanel.jsx`
- `client/src/components/TrackModal.jsx`
- `client/src/components/StatusBadge.jsx`
- `client/src/components/ProgressBar.jsx`
- `client/src/hooks/useShipments.js`
- `client/src/api/shipments.js`
- `client/src/shipping/services/shipmentService.js`

Proof used for removal:
- `client/src/App.jsx` routes only to the premium shipment/storage pages.
- After premium page migration, no remaining `client/src` imports referenced the deleted files.

## Refactors completed
- Centralized frontend shipment API calls in `client/src/shipping/services/shipmentApi.ts`.
- Centralized active shipment state in `client/src/shipping/hooks/useShipments.js`.
- Split the shipment table into focused pieces:
  - `ShipmentTable.jsx`
  - `ShipmentTableHeader.jsx`
  - `ShipmentRow.jsx`
  - `ShipmentMobileCard.jsx`
  - `ShipmentTableFiltersSheet.jsx`
- Extracted reusable batch and KPI UI:
  - `ShipmentBulkActions.jsx`
  - `ShipmentKpiCards.jsx`
- Centralized DHL dashboard mapping in `app/services/dhl_status.py` and wired `app/services/dhl.py` to it.

## Bugs fixed
- Removed unused `projectsService` import from shipment tracking modal.
- Stopped the Storage page from double-loading active shipments before archived shipments by adding `initialArchivedView`.
- Replaced silent shipment detail hydration failures with real user-facing warning text.
- Fixed Excel import column normalization so dotted headers like `Booking dt.` are preserved as usable keys.
- Preserved shipment delete error text inside the detail panel confirmation flow.

## Large/mixed-responsibility files identified
- The old legacy `ShipmentTable.jsx` implementation mixed grouping, filtering, desktop/mobile rendering, selection, and actions in one file. It was replaced with a split shipping module.
- `app/api/v1/endpoints/shipments.py` is still large because it owns export formatting plus several endpoints. It remains active and was kept intact beyond the import bug fix to avoid shipment behavior regressions.
- `app/services/dhl_provider.py` still contains provider-specific parsing logic tightly coupled to the SOAP payload shape. It was intentionally left in place because a deeper parser refactor carries carrier regression risk.

## Intentionally kept
- Backend DHL/FedEx tracking orchestration in `app/services/shipment_service.py`
- Google Sheet webhook flow in `app/api/v1/endpoints/shipments.py`
- Master-child nesting logic across backend tracking/import/export flows
- Right-side shipment detail panel behavior and existing CSS class contract
