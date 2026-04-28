export interface ShipmentEvent {
    description?: string;
    location?: string;
    status?: string;
    date?: string;
    raw_status?: string;
    [key: string]: any;
}

export interface ShipmentRecord {
    id?: number;
    tracking_number?: string;
    status?: string;
    raw_status?: string;
    carrier?: string;
    origin?: string;
    destination?: string;
    eta?: string;
    last_scan_date?: string;
    history?: ShipmentEvent[];
    recipient?: string;
    project_client_name?: string;
    items?: string;
    show_date?: string;
    booking_date?: string;
    is_master?: boolean;
    master_tracking_number?: string;
    child_parcels?: ShipmentRecord[];
    is_archived?: boolean;
    [key: string]: any;
}

export interface ShipmentGroup {
    master: ShipmentRecord;
    children: ShipmentRecord[];
    masterKey?: string;
    childRows?: (ShipmentRecord & { __displayTracking?: string; __sourceChild?: ShipmentRecord; __rowKey?: string })[];
}
