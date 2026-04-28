export const SHIPMENT_STATUS = {
    DELIVERED: 'Delivered',
    IN_TRANSIT: 'In Transit',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    EXCEPTION: 'Exception',
    UNKNOWN: 'Unknown'
} as const;

export type ShipmentStatus = typeof SHIPMENT_STATUS[keyof typeof SHIPMENT_STATUS];
