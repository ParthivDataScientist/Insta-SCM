import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    Clipboard,
    Copy,
    Loader,
    Menu,
    Moon,
    PackageCheck,
    Receipt,
    ShieldCheck,
    Sun,
    Tag,
    Truck,
    Warehouse,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app/AppShell';
import AlertBanner from '../components/AlertBanner';
import shipmentsService from '../api/shipments';
import '../design-premium.css';

function toDateInput(offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

function createTestBookingForm() {
    const today = toDateInput();
    const reference = `TEST-INV-${today.replaceAll('-', '')}`;

    return {
        shipper: {
            company_name: 'Insta Exhibition Production Site',
            name: 'Insta House',
            email: 'production@insta-exhibitions.com',
            phone: '7977572486',
            address_line1: '1-A, K.T. Industrial Park',
            address_line2: 'Bilal Pada, Goraipada',
            address_line3: '',
            city: 'Vasai Road (East), Palghar',
            state_code: '27',
            state: 'Maharashtra',
            postal_code: '401208',
            country_code: 'IN',
            country_name: 'INDIA',
        },
        receiver: {
            company_name: 'Test Company LLC',
            name: 'Test Receiver',
            email: 'test@example.com',
            phone: '2015550123',
            address_line1: '123 Test Street',
            address_line2: 'Suite 100',
            address_line3: '',
            city: 'NEW YORK',
            state_code: 'NY',
            postal_code: '10012',
            country_code: 'US',
            country_name: 'UNITED STATES OF AMERICA',
        },
        package: {
            pieces: 1,
            declared_value: '5000',
            declared_currency: 'INR',
            // Individual piece specs array
            items: [
                { id: 1, name: 'Box 1: Display Stand', weight_kg: '2.5', length_cm: '30', width_cm: '20', height_cm: '15' }
            ]
        },
        shipment: {
            shipment_type: 'CSB_V',
            description: 'EXHIBITION DISPLAY SAMPLE',
            service_type: 'P',
            local_product_code: 'P',
            terms_of_trade: 'DAP',
            shipping_payment_type: 'S',
            duty_payment_type: 'R',
            is_dutiable: true,
            shipper_reference: reference,
            exhibition_name: 'Test Expo',
            show_date: toDateInput(14),
        },
        commercial: {
            iec_no: 'ABOPK6898D',
            gstin: '27AAACK4000B1ZY',
            bank_ad_code: '6390300',
            invoice_number: reference,
            invoice_date: today,
            use_dhl_invoice: 'Y',
            using_ecommerce: '0',
            is_under_meis_scheme: '0',
            is_using_igst: 'No',
            using_bond_or_ut: 'Yes',
            manufacture_country_code: 'IN',
            manufacture_country_name: 'INDIA',
            hs_code: '61091000',
            commodity_code: '6109100010',
            commodity_type: 'Others',
            invoice_rate_per_unit: '5000',
            quantity: 1,
            uom: 'PCS',
            cess_amount: 0,
            igst_amount: 0,
            igst_percentage: '',
            taxable_value: '5000',
            special_service: 'DS',
            place_of_supply: 'Mumbai',
            date_of_supply: today,
            shipper_state_code: '27',
            shipper_state_name: 'Maharashtra',
        },
    };
}

function normalizeApiError(err, fallback) {
    const detail = err?.response?.data?.detail;
    if (Array.isArray(detail)) {
        return detail
            .map((item) => {
                const loc = Array.isArray(item?.loc) ? item.loc.slice(1).join(' > ') : '';
                const msg = item?.msg || 'Invalid value';
                return loc ? `${loc}: ${msg}` : msg;
            })
            .join(' | ');
    }
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object') {
        if (typeof detail.msg === 'string') return detail.msg;
        try {
            return JSON.stringify(detail);
        } catch (_) {
            return fallback;
        }
    }
    return err?.message || fallback;
}

function parseNumberInput(value) {
    const token = String(value ?? '').trim();
    if (!token) return null;
    const parsed = Number(token);
    return Number.isFinite(parsed) ? parsed : null;
}

function validateBookingForm(form) {
    const shipmentType = form.shipment.shipment_type || 'CSB_V';
    const requiredTextFields = [
        ['receiver.name', form.receiver.name],
        ['receiver.phone', form.receiver.phone],
        ['receiver.address_line1', form.receiver.address_line1],
        ['receiver.city', form.receiver.city],
        ['receiver.postal_code', form.receiver.postal_code],
        ['receiver.country_code', form.receiver.country_code],
        ['shipper.name', form.shipper.name],
        ['shipper.phone', form.shipper.phone],
        ['shipper.address_line1', form.shipper.address_line1],
        ['shipper.city', form.shipper.city],
        ['shipper.postal_code', form.shipper.postal_code],
        ['shipper.country_code', form.shipper.country_code],
        ['shipment.description', form.shipment.description],
    ];
    if (shipmentType !== 'NORMAL') {
        requiredTextFields.push(
            ['commercial.gstin', form.commercial.gstin],
            ['commercial.invoice_number', form.commercial.invoice_number],
            ['commercial.invoice_date', form.commercial.invoice_date],
            ['commercial.hs_code', form.commercial.hs_code],
        );
    }
    if (shipmentType === 'CSB_V') {
        requiredTextFields.push(
            ['commercial.iec_no', form.commercial.iec_no],
            ['commercial.bank_ad_code', form.commercial.bank_ad_code],
            ['commercial.shipper_state_code', form.commercial.shipper_state_code],
            ['commercial.shipper_state_name', form.commercial.shipper_state_name],
        );
    }

    for (const [label, value] of requiredTextFields) {
        if (!String(value || '').trim()) {
            return `${label} is required`;
        }
    }

    const numericChecks = [
        ['package.pieces', parseNumberInput(form.package.pieces), 1],
    ];
    const items = form.package.items || [];
    if (items.length > 0) {
        items.forEach((item, idx) => {
            numericChecks.push(
                [`package.items[${idx}].weight_kg`, parseNumberInput(item.weight_kg), 0.0001],
                [`package.items[${idx}].length_cm`, parseNumberInput(item.length_cm), 0.0001],
                [`package.items[${idx}].width_cm`, parseNumberInput(item.width_cm), 0.0001],
                [`package.items[${idx}].height_cm`, parseNumberInput(item.height_cm), 0.0001],
            );
        });
    } else {
        numericChecks.push(
            ['package.weight_kg', parseNumberInput(form.package.weight_kg), 0.0001],
            ['package.length_cm', parseNumberInput(form.package.length_cm), 0.0001],
            ['package.width_cm', parseNumberInput(form.package.width_cm), 0.0001],
            ['package.height_cm', parseNumberInput(form.package.height_cm), 0.0001],
        );
    }
    if (shipmentType === 'CSB_V') {
        numericChecks.push(['commercial.quantity', parseNumberInput(form.commercial.quantity), 1]);
    }

    for (const [label, numericValue, minValue] of numericChecks) {
        if (numericValue === null || numericValue < minValue) {
            return `${label} must be a valid number`;
        }
    }

    const currency = String(form.package.declared_currency || '').trim().toUpperCase();
    if (currency.length !== 3) {
        return 'package.declared_currency must be a 3-letter code';
    }

    const countryCode = String(form.receiver.country_code || '').trim().toUpperCase();
    if (countryCode.length !== 2) {
        return 'receiver.country_code must be a 2-letter code';
    }
    const shipperCountryCode = String(form.shipper.country_code || '').trim().toUpperCase();
    if (shipperCountryCode.length !== 2) {
        return 'shipper.country_code must be a 2-letter code';
    }
    if (
        shipmentType !== 'NORMAL' &&
        !/^\d{8}$/.test(String(form.commercial.hs_code || '').trim())
    ) {
        return 'commercial.hs_code must be a valid 8-digit export HS code';
    }
    if (
        countryCode === 'US' &&
        shipmentType === 'CSB_V' &&
        !/^\d{10}$/.test(String(form.commercial.commodity_code || '').trim())
    ) {
        return 'commercial.commodity_code must be a valid 10-digit import HS code for USA-bound shipments';
    }

    return '';
}

function buildPayload(form) {
    return {
        shipper: {
            ...form.shipper,
            country_code: form.shipper.country_code.trim().toUpperCase(),
            company_name: form.shipper.company_name || null,
            email: form.shipper.email || null,
            address_line2: form.shipper.address_line2 || null,
            address_line3: form.shipper.address_line3 || null,
            state_code: form.shipper.state_code || null,
            country_name: form.shipper.country_name || null,
        },
        receiver: {
            ...form.receiver,
            country_code: form.receiver.country_code.trim().toUpperCase(),
            company_name: form.receiver.company_name || null,
            email: form.receiver.email || null,
            address_line2: form.receiver.address_line2 || null,
            address_line3: form.receiver.address_line3 || null,
            state_code: form.receiver.state_code || null,
            country_name: form.receiver.country_name || null,
        },
        package: {
            pieces: parseNumberInput(form.package.pieces) ?? 0,
            weight_kg: parseNumberInput(form.package.items?.[0]?.weight_kg || form.package.weight_kg) ?? 0,
            length_cm: parseNumberInput(form.package.items?.[0]?.length_cm || form.package.length_cm) ?? 0,
            width_cm: parseNumberInput(form.package.items?.[0]?.width_cm || form.package.width_cm) ?? 0,
            height_cm: parseNumberInput(form.package.items?.[0]?.height_cm || form.package.height_cm) ?? 0,
            declared_value: parseNumberInput(form.package.declared_value) ?? 0,
            declared_currency: form.package.declared_currency.trim().toUpperCase(),
            items: (form.package.items || []).map((item) => ({
                name: item.name || `Box ${item.id || 1}`,
                weight_kg: parseNumberInput(item.weight_kg) ?? 0,
                length_cm: parseNumberInput(item.length_cm) ?? 0,
                width_cm: parseNumberInput(item.width_cm) ?? 0,
                height_cm: parseNumberInput(item.height_cm) ?? 0,
            })),
        },
        shipment: {
            ...form.shipment,
            shipment_type: form.shipment.shipment_type || 'CSB_V',
            local_product_code: form.shipment.local_product_code || null,
            terms_of_trade: form.shipment.terms_of_trade || null,
            shipping_payment_type: form.shipment.shipping_payment_type || null,
            duty_payment_type: form.shipment.duty_payment_type || null,
            shipper_reference: form.shipment.shipper_reference || null,
            exhibition_name: form.shipment.exhibition_name || null,
            show_date: form.shipment.show_date || null,
        },
        commercial: {
            ...form.commercial,
            iec_no: form.commercial.iec_no || null,
            gstin: form.commercial.gstin || null,
            bank_ad_code: form.commercial.bank_ad_code || null,
            invoice_number: form.commercial.invoice_number || null,
            invoice_date: form.commercial.invoice_date || null,
            hs_code: form.commercial.hs_code || null,
            commodity_code: form.commercial.commodity_code || null,
            manufacture_country_code: form.commercial.manufacture_country_code.trim().toUpperCase(),
            invoice_rate_per_unit: parseNumberInput(form.commercial.invoice_rate_per_unit),
            quantity: parseNumberInput(form.commercial.quantity) ?? 1,
            uom: 'PCS',
            cess_amount: parseNumberInput(form.commercial.cess_amount) ?? 0,
            igst_amount: parseNumberInput(form.commercial.igst_amount) ?? 0,
            igst_percentage: parseNumberInput(form.commercial.igst_percentage),
            taxable_value: parseNumberInput(form.commercial.taxable_value),
            place_of_supply: form.commercial.place_of_supply || null,
            date_of_supply: form.commercial.date_of_supply || null,
            shipper_state_code: form.commercial.shipper_state_code || null,
            shipper_state_name: form.commercial.shipper_state_name || null,
        },
    };
}

function BookingField({ label, children, hint }) {
    return (
        <label className="booking-field">
            <span className="booking-field__label">{label}</span>
            {children}
            {hint ? <span className="booking-field__hint">{hint}</span> : null}
        </label>
    );
}

function BookingSection({ icon: Icon, title, subtitle, children, className = '' }) {
    return (
        <section className={`shipment-booking-card ${className}`.trim()}>
            <div className="shipment-booking-card__header">
                <span className="shipment-booking-card__icon">
                    <Icon size={17} />
                </span>
                <div>
                    <h2>{title}</h2>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
            </div>
            {children}
        </section>
    );
}

function FieldGroup({ title, children }) {
    return (
        <div className="booking-field-group">
            <div className="booking-field-group__title">{title}</div>
            <div className="shipment-booking-form-grid">{children}</div>
        </div>
    );
}

function StepStatusPill({ status }) {
    return <span className={`booking-step-status booking-step-status--${status.toLowerCase()}`}>{status}</span>;
}

function BookingProgressStep({ number, title, detail, status }) {
    return (
        <div className={`booking-progress-step booking-progress-step--${status.toLowerCase()}`}>
            <div className="booking-progress-step__marker">
                {status === 'Completed' || status === 'Success' ? <CheckCircle2 size={15} /> : number}
            </div>
            <div className="booking-progress-step__body">
                <div className="booking-progress-step__top">
                    <span>{title}</span>
                    <StepStatusPill status={status} />
                </div>
                <p>{detail}</p>
            </div>
        </div>
    );
}

const FREQUENT_LOCATIONS = [
    {
        id: 'palghar',
        label: 'Palghar Warehouse (Insta House)',
        company_name: 'Insta Exhibition Production Site',
        name: 'Insta House',
        email: 'production@insta-exhibitions.com',
        phone: '7977572486',
        address_line1: '1-A, K.T. Industrial Park',
        address_line2: 'Bilal Pada, Goraipada',
        address_line3: '',
        city: 'Vasai Road (East), Palghar',
        state_code: '27',
        state: 'Maharashtra',
        postal_code: '401208',
        country_code: 'IN',
        country_name: 'INDIA',
    },
    {
        id: 'mumbai',
        label: 'Mumbai Office (Andheri)',
        company_name: 'Insta Exhibition',
        name: 'Insta Exhibition',
        email: 'info@insta-exhibitions.com',
        phone: '7977572486',
        address_line1: '1001, 10th Floor, Kohinoor Continental',
        address_line2: 'J.B Nagar, Andheri-Kurla Road',
        address_line3: '',
        city: 'Mumbai',
        state_code: '27',
        state: 'Maharashtra',
        postal_code: '400059',
        country_code: 'IN',
        country_name: 'INDIA',
    },
    {
        id: 'delhi',
        label: 'Delhi Exhibition Center (Pragati Maidan)',
        company_name: 'Pragati Maidan Exhibition Centre',
        name: 'Delhi Warehouse Manager',
        email: 'delhi@insta-exhibitions.com',
        phone: '7977572486',
        address_line1: 'Mathura Road, Pragati Maidan',
        address_line2: 'Gate No. 1',
        address_line3: '',
        city: 'New Delhi',
        state_code: '07',
        state: 'Delhi',
        postal_code: '110001',
        country_code: 'IN',
        country_name: 'INDIA',
    },
    {
        id: 'us_showroom',
        label: 'US Showroom & Warehouse (NY)',
        company_name: 'Insta USA Inc',
        name: 'US Warehouse Manager',
        email: 'us@insta-exhibitions.com',
        phone: '2015550123',
        address_line1: '123 Test Street',
        address_line2: 'Suite 100',
        address_line3: '',
        city: 'NEW YORK',
        state_code: 'NY',
        state: 'New York',
        postal_code: '10012',
        country_code: 'US',
        country_name: 'UNITED STATES OF AMERICA',
    }
];

function formatKg(value) {
    if (!Number.isFinite(value)) return '-';
    return `${value.toFixed(value >= 10 ? 1 : 2)} kg`;
}

export default function ShipmentBookingPage() {
    const [form, setForm] = useState(() => createTestBookingForm());
    const [rating, setRating] = useState(null);
    const [created, setCreated] = useState(null);
    const [pickup, setPickup] = useState(null);
    const [error, setError] = useState('');
    const [ratingLoading, setRatingLoading] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [pickupLoading, setPickupLoading] = useState(false);
    const [failedStep, setFailedStep] = useState('');
    const [copiedAwb, setCopiedAwb] = useState(false);

    const handleAutofill = (section, locationId) => {
        const loc = FREQUENT_LOCATIONS.find(l => l.id === locationId);
        if (!loc) return;
        setForm(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                company_name: loc.company_name,
                name: loc.name,
                email: loc.email,
                phone: loc.phone,
                address_line1: loc.address_line1,
                address_line2: loc.address_line2,
                address_line3: loc.address_line3 || '',
                city: loc.city,
                state_code: loc.state_code,
                state: loc.state,
                postal_code: loc.postal_code,
                country_code: loc.country_code,
                country_name: loc.country_name,
            }
        }));
    };

    useEffect(() => {
        const isDomestic = form.receiver.country_code?.trim().toUpperCase() === 'IN';
        if (isDomestic) {
            setForm((prev) => {
                let updated = false;
                const newShipment = { ...prev.shipment };
                if (newShipment.shipment_type !== 'NORMAL') {
                    newShipment.shipment_type = 'NORMAL';
                    updated = true;
                }
                if (newShipment.service_type !== 'N' || newShipment.local_product_code !== 'N') {
                    newShipment.service_type = 'N';
                    newShipment.local_product_code = 'N';
                    updated = true;
                }
                return updated ? { ...prev, shipment: newShipment } : prev;
            });
        } else {
            setForm((prev) => {
                const newShipment = { ...prev.shipment };
                if (newShipment.service_type === 'N' || newShipment.local_product_code === 'N') {
                    newShipment.service_type = 'P';
                    newShipment.local_product_code = 'P';
                    return { ...prev, shipment: newShipment };
                }
                return prev;
            });
        }
    }, [form.receiver.country_code]);

    useEffect(() => {
        const rawPieces = parseNumberInput(form.package.pieces) || 1;
        const currentItems = form.package.items || [];
        if (currentItems.length !== rawPieces) {
            setForm((prev) => {
                const newItems = [...(prev.package.items || [])];
                if (newItems.length < rawPieces) {
                    while (newItems.length < rawPieces) {
                        const lastItem = newItems[newItems.length - 1] || { weight_kg: '2.5', length_cm: '30', width_cm: '20', height_cm: '15' };
                        newItems.push({
                            id: Date.now() + newItems.length,
                            weight_kg: lastItem.weight_kg,
                            length_cm: lastItem.length_cm,
                            width_cm: lastItem.width_cm,
                            height_cm: lastItem.height_cm,
                        });
                    }
                } else if (newItems.length > rawPieces) {
                    newItems.splice(rawPieces);
                }
                return {
                    ...prev,
                    package: {
                        ...prev.package,
                        items: newItems,
                    },
                };
            });
        }
    }, [form.package.pieces]);

    const updatePieceField = (index, field, value) => {
        setForm((prev) => {
            const newItems = [...(prev.package.items || [])];
            if (newItems[index]) {
                newItems[index] = {
                    ...newItems[index],
                    [field]: value,
                };
            }
            const extra = index === 0 ? { [field]: value } : {};
            return {
                ...prev,
                package: {
                    ...prev.package,
                    ...extra,
                    items: newItems,
                },
            };
        });
    };
    const handleAddPackageRow = () => {
        setForm((prev) => {
            const currentItems = prev.package.items || [];
            const lastItem = currentItems[currentItems.length - 1] || { name: '', weight_kg: '2.5', length_cm: '30', width_cm: '20', height_cm: '15' };
            const nextIdx = currentItems.length + 1;
            const newItems = [
                ...currentItems,
                {
                    id: Date.now() + currentItems.length,
                    name: `Box ${nextIdx}`,
                    weight_kg: lastItem.weight_kg,
                    length_cm: lastItem.length_cm,
                    width_cm: lastItem.width_cm,
                    height_cm: lastItem.height_cm,
                }
            ];
            return {
                ...prev,
                package: {
                    ...prev.package,
                    pieces: newItems.length,
                    items: newItems,
                }
            };
        });
    };

    const handleRemovePackageRow = (index) => {
        setForm((prev) => {
            const currentItems = [...(prev.package.items || [])];
            if (currentItems.length <= 1) return prev;
            currentItems.splice(index, 1);
            
            const reindexedItems = currentItems.map((item, idx) => ({
                ...item,
                name: item.name.startsWith("Box ") ? `Box ${idx + 1}` : item.name
            }));
            
            return {
                ...prev,
                package: {
                    ...prev.package,
                    pieces: reindexedItems.length,
                    items: reindexedItems,
                }
            };
        });
    };

    const validationError = useMemo(() => validateBookingForm(form), [form]);
    const isCommercialShipment = form.shipment.shipment_type !== 'NORMAL';
    const isCsbVShipment = form.shipment.shipment_type === 'CSB_V';
    const dhlMode = String(import.meta.env.VITE_DHL_MODE || '').toLowerCase() === 'live' ? 'Live Mode' : 'Test Mode';
    const packagePreview = useMemo(() => {
        const items = form.package.items || [];
        let actualWeight = 0;
        let volumetricWeight = 0;

        if (items.length > 0) {
            items.forEach((item) => {
                const wt = parseNumberInput(item.weight_kg) || 0;
                const l = parseNumberInput(item.length_cm) || 0;
                const w = parseNumberInput(item.width_cm) || 0;
                const h = parseNumberInput(item.height_cm) || 0;
                actualWeight += wt;
                volumetricWeight += l && w && h ? (l * w * h) / 5000 : 0;
            });
        } else {
            const pieces = parseNumberInput(form.package.pieces) || 1;
            const wt = parseNumberInput(form.package.weight_kg) || 0;
            const l = parseNumberInput(form.package.length_cm) || 0;
            const w = parseNumberInput(form.package.width_cm) || 0;
            const h = parseNumberInput(form.package.height_cm) || 0;
            actualWeight = wt * pieces;
            volumetricWeight = l && w && h ? ((l * w * h) / 5000) * pieces : 0;
        }

        return {
            actualWeight,
            volumetricWeight,
            chargeableWeight: Math.max(actualWeight, volumetricWeight),
        };
    }, [form.package.pieces, form.package.items, form.package.weight_kg, form.package.length_cm, form.package.width_cm, form.package.height_cm]);
    const stepStatuses = useMemo(() => ({
        validate: failedStep === 'validate' || validationError ? 'Failed' : 'Completed',
        rate: failedStep === 'rate' ? 'Failed' : (rating ? 'Completed' : 'Waiting'),
        create: failedStep === 'create' ? 'Failed' : (created ? 'Success' : (rating ? 'Waiting' : 'Locked')),
        save: created?.awb ? 'Success' : (created ? 'Waiting' : 'Locked'),
    }), [created, failedStep, rating, validationError]);

    const updateSection = (section, field, value) => {
        setForm((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
    };

    const fillTestData = () => {
        setForm(createTestBookingForm());
        setRating(null);
        setCreated(null);
        setPickup(null);
        setError('');
        setFailedStep('');
        setCopiedAwb(false);
    };

    const handleRate = async () => {
        if (validationError) {
            setError(validationError);
            setFailedStep('validate');
            return;
        }
        setRatingLoading(true);
        setError('');
        setFailedStep('');
        try {
            const freshPayload = buildPayload(form);
            const result = await shipmentsService.rateShipment(freshPayload);
            setRating(result);
            setCreated(null);
            setPickup(null);
        } catch (err) {
            setError(normalizeApiError(err, 'Failed to rate shipment'));
            setFailedStep('rate');
        } finally {
            setRatingLoading(false);
        }
    };

    const handleCreate = async () => {
        if (validationError) {
            setError(validationError);
            setFailedStep('validate');
            return;
        }
        setCreateLoading(true);
        setError('');
        setFailedStep('');
        try {
            const freshPayload = buildPayload(form);
            const result = await shipmentsService.createShipment(freshPayload);
            setCreated(result);
            setPickup(null);
        } catch (err) {
            setError(normalizeApiError(err, 'Failed to create shipment'));
            setFailedStep('create');
        } finally {
            setCreateLoading(false);
        }
    };

    const handlePickup = async () => {
        if (!created?.awb) return;
        setPickupLoading(true);
        setError('');
        try {
            const result = await shipmentsService.schedulePickup({ awb: created.awb });
            setPickup(result);
        } catch (err) {
            setError(normalizeApiError(err, 'Failed to schedule pickup'));
            setFailedStep('pickup');
        } finally {
            setPickupLoading(false);
        }
    };

    const handleCopyAwb = async () => {
        if (!created?.awb) return;
        try {
            await navigator.clipboard.writeText(created.awb);
            setCopiedAwb(true);
            window.setTimeout(() => setCopiedAwb(false), 1800);
        } catch (_) {
            setError('Could not copy AWB to clipboard');
        }
    };

    return (
        <AppShell
            activeNav="dashboard"
            showGlobalDate={false}
            pageClassName="shipment-booking-page"
            mainClassName="premium-main--booking"
            header={({ toggleSidebar, isDark, toggleTheme }) => (
                <header className="booking-topbar">
                    <div className="booking-topbar__left">
                        <button type="button" className="booking-icon-button" onClick={toggleSidebar} aria-label="Open navigation">
                            <Menu size={17} />
                        </button>
                        <div>
                            <div className="booking-topbar__context">DHL Express / Booking Desk</div>
                            <div className="booking-topbar__title">Create outbound shipment</div>
                        </div>
                    </div>
                    <div className="booking-topbar__actions">
                        <span className={`booking-mode-badge ${dhlMode === 'Live Mode' ? 'booking-mode-badge--live' : ''}`}>
                            {dhlMode}
                        </span>
                        <button type="button" className="booking-icon-button" onClick={toggleTheme} title="Toggle theme">
                            {isDark ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                    </div>
                </header>
            )}
        >
            <AlertBanner message={error} />

            <div className="shipment-booking-shell">
                <div className="shipment-booking-header">
                    <div>
                        <h1>Shipment Booking</h1>
                        <p>Create DHL shipment, fetch rate, generate AWB, and save label automatically.</p>
                    </div>
                    <div className="shipment-booking-header__actions">
                        <button type="button" className="booking-secondary-button" onClick={fillTestData}>
                            <Receipt size={15} /> Fill Test Data
                        </button>
                        <Link to="/dashboard" className="booking-secondary-button">
                            <ArrowLeft size={15} /> Back to Dashboard
                        </Link>
                    </div>
                </div>

                <div className="shipment-booking-layout">
                    <div className="shipment-booking-form-stack">
                        <BookingSection
                            icon={Warehouse}
                            title="Shipping From (Shipper)"
                            subtitle="Contact and origin warehouse address data used directly by DHL."
                        >
                            <FieldGroup title="⚡ Quick Autofill">
                                <BookingField label="Select Frequent Location">
                                    <select
                                        className="booking-input"
                                        onChange={(e) => handleAutofill('shipper', e.target.value)}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>-- Choose pre-defined location --</option>
                                        {FREQUENT_LOCATIONS.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.label}</option>
                                        ))}
                                    </select>
                                </BookingField>
                            </FieldGroup>

                            <FieldGroup title="Contact Information">
                                <BookingField label="Attention / Brand Name">
                                    <input className="booking-input" value={form.shipper.name} onChange={(event) => updateSection('shipper', 'name', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Company / Site Name">
                                    <input className="booking-input" value={form.shipper.company_name} onChange={(event) => updateSection('shipper', 'company_name', event.target.value)} />
                                </BookingField>
                                <BookingField label="Email">
                                    <input className="booking-input" type="email" value={form.shipper.email} onChange={(event) => updateSection('shipper', 'email', event.target.value)} />
                                </BookingField>
                                <BookingField label="Phone">
                                    <input className="booking-input" value={form.shipper.phone} onChange={(event) => updateSection('shipper', 'phone', event.target.value)} required />
                                </BookingField>
                            </FieldGroup>

                            <FieldGroup title="Address">
                                <BookingField label="Address Line 1">
                                    <input className="booking-input" value={form.shipper.address_line1} onChange={(event) => updateSection('shipper', 'address_line1', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Address Line 2">
                                    <input className="booking-input" value={form.shipper.address_line2} onChange={(event) => updateSection('shipper', 'address_line2', event.target.value)} />
                                </BookingField>
                                <BookingField label="City">
                                    <input className="booking-input" value={form.shipper.city} onChange={(event) => updateSection('shipper', 'city', event.target.value)} required />
                                </BookingField>
                                <BookingField label="State Code" hint="Use shipper state or province code (e.g. 27).">
                                    <input className="booking-input" value={form.shipper.state_code} onChange={(event) => updateSection('shipper', 'state_code', event.target.value)} />
                                </BookingField>
                                <BookingField label="State Name">
                                    <input className="booking-input" value={form.shipper.state} onChange={(event) => updateSection('shipper', 'state', event.target.value)} />
                                </BookingField>
                                <BookingField label="Postal Code">
                                    <input className="booking-input" value={form.shipper.postal_code} onChange={(event) => updateSection('shipper', 'postal_code', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Country Code" hint="ISO 2-letter code, e.g. IN.">
                                    <input className="booking-input" value={form.shipper.country_code} onChange={(event) => updateSection('shipper', 'country_code', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Country Name">
                                    <input className="booking-input" value={form.shipper.country_name} onChange={(event) => updateSection('shipper', 'country_name', event.target.value)} />
                                </BookingField>
                            </FieldGroup>
                        </BookingSection>

                        <BookingSection
                            icon={Truck}
                            title="Receiver Details"
                            subtitle="Contact and destination data used directly by DHL."
                        >
                            <FieldGroup title="⚡ Quick Autofill">
                                <BookingField label="Select Frequent Location">
                                    <select
                                        className="booking-input"
                                        onChange={(e) => handleAutofill('receiver', e.target.value)}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>-- Choose pre-defined location --</option>
                                        {FREQUENT_LOCATIONS.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.label}</option>
                                        ))}
                                    </select>
                                </BookingField>
                            </FieldGroup>

                            <FieldGroup title="Contact Information">
                                <BookingField label="Receiver Name">
                                    <input className="booking-input" value={form.receiver.name} onChange={(event) => updateSection('receiver', 'name', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Company">
                                    <input className="booking-input" value={form.receiver.company_name} onChange={(event) => updateSection('receiver', 'company_name', event.target.value)} />
                                </BookingField>
                                <BookingField label="Email">
                                    <input className="booking-input" type="email" value={form.receiver.email} onChange={(event) => updateSection('receiver', 'email', event.target.value)} />
                                </BookingField>
                                <BookingField label="Phone">
                                    <input className="booking-input" value={form.receiver.phone} onChange={(event) => updateSection('receiver', 'phone', event.target.value)} required />
                                </BookingField>
                            </FieldGroup>

                            <FieldGroup title="Address">
                                <BookingField label="Address Line 1">
                                    <input className="booking-input" value={form.receiver.address_line1} onChange={(event) => updateSection('receiver', 'address_line1', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Address Line 2">
                                    <input className="booking-input" value={form.receiver.address_line2} onChange={(event) => updateSection('receiver', 'address_line2', event.target.value)} />
                                </BookingField>
                                <BookingField label="City">
                                    <input className="booking-input" value={form.receiver.city} onChange={(event) => updateSection('receiver', 'city', event.target.value)} required />
                                </BookingField>
                                <BookingField label="State Code" hint="Use receiver state or province code when required.">
                                    <input className="booking-input" value={form.receiver.state_code} onChange={(event) => updateSection('receiver', 'state_code', event.target.value)} />
                                </BookingField>
                                <BookingField label="Postal Code">
                                    <input className="booking-input" value={form.receiver.postal_code} onChange={(event) => updateSection('receiver', 'postal_code', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Country Code" hint="ISO 2-letter code, e.g. US.">
                                    <input className="booking-input" value={form.receiver.country_code} onChange={(event) => updateSection('receiver', 'country_code', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Country Name">
                                    <input className="booking-input" value={form.receiver.country_name} onChange={(event) => updateSection('receiver', 'country_name', event.target.value)} />
                                </BookingField>
                            </FieldGroup>
                        </BookingSection>

                        <BookingSection
                            icon={PackageCheck}
                            title="Package Details"
                            subtitle="Pieces, physical dimensions, package type, and shipment content."
                        >
                            <div className="shipment-booking-form-grid" style={{ marginBottom: '16px' }}>
                                <BookingField label="Package Type">
                                    <select 
                                        className="booking-input" 
                                        value={form.shipment.shipment_type} 
                                        disabled={form.receiver.country_code?.trim().toUpperCase() === 'IN'}
                                        onChange={(event) => updateSection('shipment', 'shipment_type', event.target.value)}
                                    >
                                        <option value="NORMAL">Normal</option>
                                        <option value="CSB_IV_CARGO">CSB-IV Cargo</option>
                                        <option value="CSB_V">CSB-V</option>
                                    </select>
                                    {form.receiver.country_code?.trim().toUpperCase() === 'IN' && (
                                        <div className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200/50 dark:border-amber-900/30">
                                            Domestic shipments from India are automatically processed via standard Normal routing.
                                        </div>
                                    )}
                                </BookingField>
                                <BookingField label="Shipment Content">
                                    <input className="booking-input" value={form.shipment.description} onChange={(event) => updateSection('shipment', 'description', event.target.value)} required />
                                </BookingField>
                            </div>

                            <div className="mt-4 pt-2">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                    Package Specifications (MPS Row-wise)
                                </div>
                                
                                <div className="booking-package-table-header">
                                    <div style={{ flex: 3.5 }}>Package Description / Name</div>
                                    <div style={{ flex: 1.5 }}>Weight (kg)</div>
                                    <div style={{ flex: 1.2 }}>L (cm)</div>
                                    <div style={{ flex: 1.2 }}>W (cm)</div>
                                    <div style={{ flex: 1.2 }}>H (cm)</div>
                                    <div style={{ width: '40px', textAlign: 'center' }}>Action</div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {(form.package.items || []).map((item, idx) => (
                                        <div key={item.id || idx} className="booking-package-row">
                                            <div style={{ flex: 3.5 }}>
                                                <input 
                                                    className="booking-input" 
                                                    placeholder="e.g. Box 1: Display Stand" 
                                                    value={item.name || ''} 
                                                    onChange={(event) => updatePieceField(idx, 'name', event.target.value)} 
                                                    required 
                                                />
                                            </div>
                                            <div style={{ flex: 1.5 }}>
                                                <input 
                                                    className="booking-input" 
                                                    type="text" 
                                                    inputMode="decimal" 
                                                    value={item.weight_kg} 
                                                    onChange={(event) => updatePieceField(idx, 'weight_kg', event.target.value)} 
                                                    required 
                                                />
                                            </div>
                                            <div style={{ flex: 1.2 }}>
                                                <input 
                                                    className="booking-input" 
                                                    type="text" 
                                                    inputMode="decimal" 
                                                    value={item.length_cm} 
                                                    onChange={(event) => updatePieceField(idx, 'length_cm', event.target.value)} 
                                                    required 
                                                />
                                            </div>
                                            <div style={{ flex: 1.2 }}>
                                                <input 
                                                    className="booking-input" 
                                                    type="text" 
                                                    inputMode="decimal" 
                                                    value={item.width_cm} 
                                                    onChange={(event) => updatePieceField(idx, 'width_cm', event.target.value)} 
                                                    required 
                                                />
                                            </div>
                                            <div style={{ flex: 1.2 }}>
                                                <input 
                                                    className="booking-input" 
                                                    type="text" 
                                                    inputMode="decimal" 
                                                    value={item.height_cm} 
                                                    onChange={(event) => updatePieceField(idx, 'height_cm', event.target.value)} 
                                                    required 
                                                />
                                            </div>
                                            <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                                                <button
                                                    type="button"
                                                    className="booking-delete-row-btn"
                                                    disabled={form.package.items.length <= 1}
                                                    onClick={() => handleRemovePackageRow(idx)}
                                                    title="Remove package"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="booking-package-table-footer">
                                    <button 
                                        type="button" 
                                        className="booking-btn booking-btn--primary" 
                                        style={{ height: '36px', padding: '0 12px', fontSize: '12px' }}
                                        onClick={handleAddPackageRow}
                                    >
                                        + Add Package
                                    </button>
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                        Total pieces: {form.package.items?.length || 1}
                                    </span>
                                </div>
                            </div>
                            <div className="booking-weight-preview">
                                <div>
                                    <span>Actual weight</span>
                                    <strong>{formatKg(packagePreview.actualWeight)}</strong>
                                </div>
                                <div>
                                    <span>Volumetric weight</span>
                                    <strong>{formatKg(packagePreview.volumetricWeight)}</strong>
                                </div>
                                <div>
                                    <span>Chargeable weight</span>
                                    <strong>{formatKg(packagePreview.chargeableWeight)}</strong>
                                </div>
                            </div>
                        </BookingSection>

                        <BookingSection
                            icon={ShieldCheck}
                            title="Shipment Options"
                            subtitle="Service, billing terms, declared value, and show context."
                        >
                            <div className="shipment-booking-form-grid">
                                <BookingField label="DHL Service Tier">
                                    <select
                                        className="booking-input"
                                        value={form.shipment.service_type}
                                        disabled={form.receiver.country_code?.trim().toUpperCase() === 'IN'}
                                        onChange={(event) => {
                                            const val = event.target.value;
                                            setForm((prev) => ({
                                                ...prev,
                                                shipment: {
                                                    ...prev.shipment,
                                                    service_type: val,
                                                    local_product_code: val,
                                                },
                                            }));
                                        }}
                                    >
                                        {form.receiver.country_code?.trim().toUpperCase() === 'IN' ? (
                                            <option value="N">EXPRESS DOMESTIC</option>
                                        ) : (
                                            <>
                                                <option value="P">EXPRESS WORLDWIDE</option>
                                                <option value="U">EXPRESS WORLDWIDE 12:00</option>
                                            </>
                                        )}
                                    </select>
                                </BookingField>
                                <BookingField label="Declared Value">
                                    <input className="booking-input" type="text" inputMode="decimal" value={form.package.declared_value} onChange={(event) => updateSection('package', 'declared_value', event.target.value)} />
                                </BookingField>
                                <BookingField label="Currency" hint="3-letter currency code.">
                                    <input className="booking-input" value={form.package.declared_currency} onChange={(event) => updateSection('package', 'declared_currency', event.target.value)} />
                                </BookingField>
                                <BookingField label="Terms of Trade">
                                    <select
                                        className="booking-input"
                                        value={form.shipment.terms_of_trade}
                                        onChange={(event) => {
                                            const val = event.target.value;
                                            const dutyPaymentType = val === 'DAP' ? 'R' : 'S';
                                            setForm((prev) => ({
                                                ...prev,
                                                shipment: {
                                                    ...prev.shipment,
                                                    terms_of_trade: val,
                                                    duty_payment_type: dutyPaymentType,
                                                },
                                            }));
                                        }}
                                    >
                                        <option value="DAP">DAP (Delivered At Place - Receiver Pays Duties)</option>
                                        <option value="DDP">DDP (Delivered Duty Paid - Shipper Pays Duties)</option>
                                    </select>
                                </BookingField>
                                <BookingField label="Dutiable">
                                    <select className="booking-input" value={form.shipment.is_dutiable ? 'true' : 'false'} onChange={(event) => updateSection('shipment', 'is_dutiable', event.target.value === 'true')}>
                                        <option value="true">Yes</option>
                                        <option value="false">No</option>
                                    </select>
                                </BookingField>
                                <BookingField label="Shipping Payment">
                                    <select
                                        className="booking-input"
                                        value={form.shipment.shipping_payment_type}
                                        disabled={true}
                                    >
                                        <option value="S">Shipper Account (Default)</option>
                                    </select>
                                </BookingField>
                                <BookingField label="Duty Payment">
                                    <select
                                        className="booking-input"
                                        value={form.shipment.duty_payment_type}
                                        disabled={true}
                                        onChange={(event) => updateSection('shipment', 'duty_payment_type', event.target.value)}
                                    >
                                        <option value="R">Receiver Pays Duties (R)</option>
                                        <option value="S">Shipper Pays Duties (S)</option>
                                    </select>
                                </BookingField>
                                <BookingField label="Reference">
                                    <input className="booking-input" value={form.shipment.shipper_reference} onChange={(event) => updateSection('shipment', 'shipper_reference', event.target.value)} />
                                </BookingField>
                                <BookingField label="Exhibition">
                                    <input className="booking-input" value={form.shipment.exhibition_name} onChange={(event) => updateSection('shipment', 'exhibition_name', event.target.value)} />
                                </BookingField>
                                <BookingField label="Show Date">
                                    <input className="booking-input" type="date" value={form.shipment.show_date} onChange={(event) => updateSection('shipment', 'show_date', event.target.value)} />
                                </BookingField>
                            </div>
                        </BookingSection>

                        {isCommercialShipment ? (
                            <BookingSection
                                icon={Receipt}
                                title={isCsbVShipment ? 'CSB-V Commercial Details' : 'CSB-IV Export Details'}
                                subtitle="Export documentation fields required for DHL booking and label generation."
                            >
                                <div className="shipment-booking-form-grid">
                                    {isCsbVShipment ? (
                                        <>
                                            <BookingField label="IEC No">
                                                <input className="booking-input" value={form.commercial.iec_no} onChange={(event) => updateSection('commercial', 'iec_no', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="GSTIN / PAN">
                                                <input className="booking-input" value={form.commercial.gstin} onChange={(event) => updateSection('commercial', 'gstin', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Bank AD Code">
                                                <input className="booking-input" value={form.commercial.bank_ad_code} onChange={(event) => updateSection('commercial', 'bank_ad_code', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Invoice No">
                                                <input className="booking-input" value={form.commercial.invoice_number} onChange={(event) => updateSection('commercial', 'invoice_number', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Invoice Date">
                                                <input className="booking-input" type="date" value={form.commercial.invoice_date} onChange={(event) => updateSection('commercial', 'invoice_date', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Export HS Code">
                                                <input className="booking-input" value={form.commercial.hs_code} onChange={(event) => updateSection('commercial', 'hs_code', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Import HS Code">
                                                <input className="booking-input" value={form.commercial.commodity_code} onChange={(event) => updateSection('commercial', 'commodity_code', event.target.value)} />
                                            </BookingField>
                                            <BookingField label="Commodity Type">
                                                <input className="booking-input" value={form.commercial.commodity_type} onChange={(event) => updateSection('commercial', 'commodity_type', event.target.value)} />
                                            </BookingField>
                                            <BookingField label="Quantity">
                                                <input className="booking-input" type="text" inputMode="numeric" value={form.commercial.quantity} onChange={(event) => updateSection('commercial', 'quantity', event.target.value)} />
                                            </BookingField>
                                            <BookingField label="Invoice Rate / Unit">
                                                <input className="booking-input" type="text" inputMode="decimal" value={form.commercial.invoice_rate_per_unit} onChange={(event) => updateSection('commercial', 'invoice_rate_per_unit', event.target.value)} />
                                            </BookingField>
                                            <BookingField label="UOM">
                                                <input className="booking-input" value={form.commercial.uom} onChange={(event) => updateSection('commercial', 'uom', event.target.value)} />
                                            </BookingField>
                                            <BookingField label="Using IGST">
                                                <select className="booking-input" value={form.commercial.is_using_igst} onChange={(event) => updateSection('commercial', 'is_using_igst', event.target.value)}>
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </BookingField>
                                            <BookingField label="Bond / LUT">
                                                <select className="booking-input" value={form.commercial.using_bond_or_ut} onChange={(event) => updateSection('commercial', 'using_bond_or_ut', event.target.value)}>
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </BookingField>
                                            <BookingField label="IGST Amount">
                                                <input className="booking-input" type="text" inputMode="decimal" value={form.commercial.igst_amount} onChange={(event) => updateSection('commercial', 'igst_amount', event.target.value)} />
                                            </BookingField>
                                            <BookingField label="Taxable Value">
                                                <input className="booking-input" type="text" inputMode="decimal" value={form.commercial.taxable_value} onChange={(event) => updateSection('commercial', 'taxable_value', event.target.value)} />
                                            </BookingField>
                                            <BookingField label="Shipper State Code" hint="Numeric export state code.">
                                                <input className="booking-input" value={form.commercial.shipper_state_code} onChange={(event) => updateSection('commercial', 'shipper_state_code', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Shipper State">
                                                <input className="booking-input" value={form.commercial.shipper_state_name} onChange={(event) => updateSection('commercial', 'shipper_state_name', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Place of Supply">
                                                <input className="booking-input" value={form.commercial.place_of_supply} onChange={(event) => updateSection('commercial', 'place_of_supply', event.target.value)} />
                                            </BookingField>
                                            <BookingField label="Date of Supply">
                                                <input className="booking-input" type="date" value={form.commercial.date_of_supply} onChange={(event) => updateSection('commercial', 'date_of_supply', event.target.value)} />
                                            </BookingField>
                                        </>
                                    ) : (
                                        <>
                                            <BookingField label="GSTIN / PAN">
                                                <input className="booking-input" value={form.commercial.gstin} onChange={(event) => updateSection('commercial', 'gstin', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Invoice No">
                                                <input className="booking-input" value={form.commercial.invoice_number} onChange={(event) => updateSection('commercial', 'invoice_number', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Invoice Date">
                                                <input className="booking-input" type="date" value={form.commercial.invoice_date} onChange={(event) => updateSection('commercial', 'invoice_date', event.target.value)} required />
                                            </BookingField>
                                            <BookingField label="Export HS Code">
                                                <input className="booking-input" value={form.commercial.hs_code} onChange={(event) => updateSection('commercial', 'hs_code', event.target.value)} required />
                                            </BookingField>
                                        </>
                                    )}
                                </div>
                            </BookingSection>
                        ) : null}
                    </div>

                    <aside className="booking-progress-panel" aria-label="Booking progress">
                        <div className="booking-progress-card">
                            <div className="booking-progress-card__header">
                                <div>
                                    <span className="shipment-booking-section-label">Booking Progress</span>
                                    <h2>DHL workflow</h2>
                                </div>
                                <span className="booking-progress-card__icon">
                                    <Clipboard size={18} />
                                </span>
                            </div>

                            <div className="booking-progress-steps">
                                <BookingProgressStep number="1" title="Validate Details" status={stepStatuses.validate} detail={validationError || 'Required receiver, package, and export fields are complete.'} />
                                <BookingProgressStep number="2" title="Get DHL Rate" status={stepStatuses.rate} detail={rating ? `${rating.currency} ${(Number(rating.shipping_charge || rating.price) + Number(rating.tax_amount || 0)).toFixed(2)} · ${rating.delivery_time || 'Delivery timing pending'}` : 'Fetch DHL pricing before shipment creation.'} />
                                <BookingProgressStep number="3" title="Create Shipment" status={stepStatuses.create} detail={created?.awb ? `AWB ${created.awb}` : 'Locked until a successful DHL rate is available.'} />
                                <BookingProgressStep number="4" title="Save AWB & Label" status={stepStatuses.save} detail={created?.label_url ? 'AWB saved and label file is ready.' : 'Label status appears after DHL shipment creation.'} />
                            </div>

                            <div className="booking-progress-actions">
                                <button className="booking-primary-button" onClick={handleRate} disabled={Boolean(validationError) || ratingLoading || createLoading}>
                                    {ratingLoading ? <Loader size={16} className="animate-spin" /> : <><Receipt size={16} /> Get Rate</>}
                                </button>
                                <button className="booking-primary-button" onClick={handleCreate} disabled={Boolean(validationError) || !rating || createLoading || ratingLoading}>
                                    {createLoading ? <Loader size={16} className="animate-spin" /> : <><Truck size={16} /> Create Shipment</>}
                                </button>
                            </div>

                            <div className="booking-progress-result">
                                {rating ? (
                                    <div className="booking-detailed-charges-spec">
                                        <div className="charge-detail-row charge-detail-row--header">
                                            <span>Service Tier</span>
                                            <span className="charge-detail-value charge-detail-value--tier">{rating.service_name || 'EXPRESS WORLDWIDE'}</span>
                                        </div>
                                        <div className="charge-detail-row">
                                            <span>Base Shipping Charge</span>
                                            <span className="charge-detail-value">{rating.currency} {Number(rating.shipping_charge || (rating.price - (rating.tax_amount || 0))).toFixed(2)}</span>
                                        </div>
                                        {rating.tax_amount ? (
                                            <div className="charge-detail-row">
                                                <span>Total Tax Amount</span>
                                                <span className="charge-detail-value">{rating.currency} {Number(rating.tax_amount).toFixed(2)}</span>
                                            </div>
                                        ) : null}
                                        {rating.global_services && rating.global_services.length > 0 ? (
                                            <div className="surcharge-section">
                                                <span className="surcharge-section-title">Included Carrier Surcharges:</span>
                                                {rating.global_services.map((srv, idx) => (
                                                    <div key={idx} className="surcharge-item">
                                                        <span className="surcharge-name">
                                                            <span className="surcharge-dot"></span>
                                                            {srv}
                                                        </span>
                                                        <span className="surcharge-pill">Active</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                        <div className="charge-detail-row charge-detail-row--total">
                                            <span>Estimated Total</span>
                                            <span className="charge-detail-value charge-detail-value--total">{rating.currency} {Number(rating.price || (Number(rating.shipping_charge || 0) + Number(rating.tax_amount || 0))).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400 text-center py-4">Fetch DHL pricing before shipment creation.</div>
                                )}
                                <div className="booking-result-row">
                                    <span>AWB</span>
                                    <strong>{created?.awb || 'Pending'}</strong>
                                </div>
                                <div className="booking-result-row">
                                    <span>Label</span>
                                    <strong>{created?.label_url ? 'Ready' : 'Pending'}</strong>
                                </div>
                                <div className="booking-result-row">
                                    <span>Pickup</span>
                                    <strong>{pickup?.pickup_id || pickup?.pickup_status || 'Optional'}</strong>
                                </div>
                            </div>

                            {created ? (
                                <div className="booking-completion-actions">
                                    <button type="button" className="booking-secondary-button" onClick={handleCopyAwb}>
                                        <Copy size={15} /> {copiedAwb ? 'Copied' : 'Copy AWB'}
                                    </button>
                                    {created.label_url ? (
                                        <a className="booking-secondary-button booking-secondary-button--primary" href={created.label_url} target="_blank" rel="noreferrer">
                                            <Tag size={15} /> Download Label
                                        </a>
                                    ) : (
                                        <button type="button" className="booking-secondary-button" disabled>
                                            <Tag size={15} /> Download Label
                                        </button>
                                    )}
                                    <Link to="/dashboard" className="booking-secondary-button">
                                        <Truck size={15} /> Track Shipment
                                    </Link>
                                    <button type="button" className="booking-secondary-button" onClick={handlePickup} disabled={!created?.awb || pickupLoading}>
                                        {pickupLoading ? <Loader size={15} className="animate-spin" /> : <><CalendarClock size={15} /> Schedule Pickup</>}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </aside>
                </div>
            </div>
        </AppShell>
    );
}
