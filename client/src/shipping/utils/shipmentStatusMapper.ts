import { SHIPMENT_STATUS, ShipmentStatus } from '../constants/shipmentStatus';

export const normalizeShipmentStatus = (rawStatus: string | null | undefined): ShipmentStatus => {
    if (!rawStatus) return SHIPMENT_STATUS.UNKNOWN;
    
    const v = rawStatus.toLowerCase().trim();
    
    if (v.includes('delivered') || v.includes('delivery successful')) return SHIPMENT_STATUS.DELIVERED;
    if (v.includes('exception') || v.includes('held') || v.includes('customs hold') || v.includes('delay') || v.includes('returned')) return SHIPMENT_STATUS.EXCEPTION;
    if (v.includes('out for delivery') || v.includes('with courier')) return SHIPMENT_STATUS.OUT_FOR_DELIVERY;
    if (v.includes('transit') || v.includes('departed') || v.includes('arrived') || v.includes('processed') || v.includes('sorted') || v.includes('picked up')) return SHIPMENT_STATUS.IN_TRANSIT;
    
    // Fallback: If it matches exact known statuses
    if (v === 'delivered') return SHIPMENT_STATUS.DELIVERED;
    if (v === 'exception') return SHIPMENT_STATUS.EXCEPTION;
    if (v === 'out for delivery') return SHIPMENT_STATUS.OUT_FOR_DELIVERY;
    if (v === 'in transit') return SHIPMENT_STATUS.IN_TRANSIT;
    
    return rawStatus as ShipmentStatus; // Return original if unknown but typed
};
