import React, { useMemo, useState } from 'react';
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

const shipperAddress = {
    site_name: 'Insta Exhibition Production Site',
    company_name: 'Insta House',
    address_line1: '1-A, K.T. Industrial Park',
    address_line2: 'Bilal Pada, Goraipada',
    city: 'Vasai Road (East), Palghar',
    state: 'Maharashtra',
    postal_code: '401208',
    country_code: 'IN',
};

function toDateInput(offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

function createTestBookingForm() {
    const today = toDateInput();
    const reference = `TEST-INV-${today.replaceAll('-', '')}`;

    return {
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
            weight_kg: '2.5',
            length_cm: '30',
            width_cm: '20',
            height_cm: '15',
            declared_value: '5000',
            declared_currency: 'INR',
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
        ['package.weight_kg', parseNumberInput(form.package.weight_kg), 0.0001],
        ['package.length_cm', parseNumberInput(form.package.length_cm), 0.0001],
        ['package.width_cm', parseNumberInput(form.package.width_cm), 0.0001],
        ['package.height_cm', parseNumberInput(form.package.height_cm), 0.0001],
    ];
    if (shipmentType !== 'NORMAL') {
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
    if (
        shipmentType !== 'NORMAL' &&
        !/^\d{8}$/.test(String(form.commercial.hs_code || '').trim())
    ) {
        return 'commercial.hs_code must be a valid 8-digit export HS code';
    }
    if (
        countryCode === 'US' &&
        shipmentType !== 'NORMAL' &&
        !/^\d{10}$/.test(String(form.commercial.commodity_code || '').trim())
    ) {
        return 'commercial.commodity_code must be a valid 10-digit import HS code for USA-bound shipments';
    }

    return '';
}

function buildPayload(form) {
    return {
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
            weight_kg: parseNumberInput(form.package.weight_kg) ?? 0,
            length_cm: parseNumberInput(form.package.length_cm) ?? 0,
            width_cm: parseNumberInput(form.package.width_cm) ?? 0,
            height_cm: parseNumberInput(form.package.height_cm) ?? 0,
            declared_value: parseNumberInput(form.package.declared_value) ?? 0,
            declared_currency: form.package.declared_currency.trim().toUpperCase(),
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

    const payload = useMemo(() => buildPayload(form), [form]);
    const validationError = useMemo(() => validateBookingForm(form), [form]);
    const isCommercialShipment = form.shipment.shipment_type !== 'NORMAL';
    const isCsbVShipment = form.shipment.shipment_type === 'CSB_V';
    const dhlMode = String(import.meta.env.VITE_DHL_MODE || '').toLowerCase() === 'live' ? 'Live Mode' : 'Test Mode';
    const packagePreview = useMemo(() => {
        const pieces = parseNumberInput(form.package.pieces) || 1;
        const actualWeight = (parseNumberInput(form.package.weight_kg) || 0) * pieces;
        const length = parseNumberInput(form.package.length_cm) || 0;
        const width = parseNumberInput(form.package.width_cm) || 0;
        const height = parseNumberInput(form.package.height_cm) || 0;
        const volumetricWeight = length && width && height ? ((length * width * height) / 5000) * pieces : 0;
        return {
            actualWeight,
            volumetricWeight,
            chargeableWeight: Math.max(actualWeight, volumetricWeight),
        };
    }, [form.package.height_cm, form.package.length_cm, form.package.pieces, form.package.weight_kg, form.package.width_cm]);
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
            const result = await shipmentsService.rateShipment(payload);
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
            const result = await shipmentsService.createShipment(payload);
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
                        <section className="shipment-booking-origin">
                            <div className="shipment-booking-origin__top">
                                <div>
                                    <div className="shipment-booking-section-label">Shipping From</div>
                                    <h2>{shipperAddress.site_name}</h2>
                                </div>
                                <span className="booking-warehouse-badge">
                                    <Warehouse size={13} /> Default warehouse
                                </span>
                            </div>
                            <p>
                                {shipperAddress.company_name}, {shipperAddress.address_line1}, {shipperAddress.address_line2},{' '}
                                {shipperAddress.city}, {shipperAddress.state} - {shipperAddress.postal_code}, {shipperAddress.country_code}
                            </p>
                        </section>

                        <BookingSection
                            icon={Truck}
                            title="Receiver Details"
                            subtitle="Contact and destination data used directly by DHL."
                        >
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
                            <div className="shipment-booking-form-grid">
                                <BookingField label="Package Type">
                                    <select className="booking-input" value={form.shipment.shipment_type} onChange={(event) => updateSection('shipment', 'shipment_type', event.target.value)}>
                                        <option value="NORMAL">Normal</option>
                                        <option value="CSB_IV_CARGO">CSB-IV Cargo</option>
                                        <option value="CSB_V">CSB-V</option>
                                    </select>
                                </BookingField>
                                <BookingField label="Shipment Content">
                                    <input className="booking-input" value={form.shipment.description} onChange={(event) => updateSection('shipment', 'description', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Pieces">
                                    <input className="booking-input" type="text" inputMode="numeric" value={form.package.pieces} onChange={(event) => updateSection('package', 'pieces', event.target.value)} />
                                </BookingField>
                                <BookingField label="Weight (kg)">
                                    <input className="booking-input" type="text" inputMode="decimal" value={form.package.weight_kg} onChange={(event) => updateSection('package', 'weight_kg', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Length (cm)">
                                    <input className="booking-input" type="text" inputMode="decimal" value={form.package.length_cm} onChange={(event) => updateSection('package', 'length_cm', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Width (cm)">
                                    <input className="booking-input" type="text" inputMode="decimal" value={form.package.width_cm} onChange={(event) => updateSection('package', 'width_cm', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Height (cm)">
                                    <input className="booking-input" type="text" inputMode="decimal" value={form.package.height_cm} onChange={(event) => updateSection('package', 'height_cm', event.target.value)} required />
                                </BookingField>
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
                                <BookingField label="Service Type">
                                    <input className="booking-input" value={form.shipment.service_type} onChange={(event) => updateSection('shipment', 'service_type', event.target.value)} />
                                </BookingField>
                                <BookingField label="Local Product Code">
                                    <input className="booking-input" value={form.shipment.local_product_code} onChange={(event) => updateSection('shipment', 'local_product_code', event.target.value)} />
                                </BookingField>
                                <BookingField label="Declared Value">
                                    <input className="booking-input" type="text" inputMode="decimal" value={form.package.declared_value} onChange={(event) => updateSection('package', 'declared_value', event.target.value)} />
                                </BookingField>
                                <BookingField label="Currency" hint="3-letter currency code.">
                                    <input className="booking-input" value={form.package.declared_currency} onChange={(event) => updateSection('package', 'declared_currency', event.target.value)} />
                                </BookingField>
                                <BookingField label="Terms of Trade">
                                    <input className="booking-input" value={form.shipment.terms_of_trade} onChange={(event) => updateSection('shipment', 'terms_of_trade', event.target.value)} />
                                </BookingField>
                                <BookingField label="Dutiable">
                                    <select className="booking-input" value={form.shipment.is_dutiable ? 'true' : 'false'} onChange={(event) => updateSection('shipment', 'is_dutiable', event.target.value === 'true')}>
                                        <option value="true">Yes</option>
                                        <option value="false">No</option>
                                    </select>
                                </BookingField>
                                <BookingField label="Shipping Payment">
                                    <input className="booking-input" value={form.shipment.shipping_payment_type} onChange={(event) => updateSection('shipment', 'shipping_payment_type', event.target.value)} />
                                </BookingField>
                                <BookingField label="Duty Payment">
                                    <input className="booking-input" value={form.shipment.duty_payment_type} onChange={(event) => updateSection('shipment', 'duty_payment_type', event.target.value)} />
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
                                title={isCsbVShipment ? 'CSB-V Commercial Details' : 'CSB-IV Cargo Details'}
                                subtitle="Export documentation fields required for DHL booking and label generation."
                            >
                                <div className="shipment-booking-form-grid">
                                    {isCsbVShipment ? (
                                        <BookingField label="IEC No">
                                            <input className="booking-input" value={form.commercial.iec_no} onChange={(event) => updateSection('commercial', 'iec_no', event.target.value)} required />
                                        </BookingField>
                                    ) : null}
                                    <BookingField label="GSTIN / PAN">
                                        <input className="booking-input" value={form.commercial.gstin} onChange={(event) => updateSection('commercial', 'gstin', event.target.value)} required />
                                    </BookingField>
                                    {isCsbVShipment ? (
                                        <BookingField label="Bank AD Code">
                                            <input className="booking-input" value={form.commercial.bank_ad_code} onChange={(event) => updateSection('commercial', 'bank_ad_code', event.target.value)} required />
                                        </BookingField>
                                    ) : null}
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
                                    {isCsbVShipment ? (
                                        <>
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
                                        </>
                                    ) : null}
                                    <BookingField label="IGST Amount">
                                        <input className="booking-input" type="text" inputMode="decimal" value={form.commercial.igst_amount} onChange={(event) => updateSection('commercial', 'igst_amount', event.target.value)} />
                                    </BookingField>
                                    {isCsbVShipment ? (
                                        <>
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
                                    ) : null}
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
                                <BookingProgressStep number="2" title="Get DHL Rate" status={stepStatuses.rate} detail={rating ? `${rating.currency} ${rating.price} · ${rating.delivery_time || 'Delivery timing pending'}` : 'Fetch DHL pricing before shipment creation.'} />
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
                                <div className="booking-result-row">
                                    <span>Rate</span>
                                    <strong>{rating ? `${rating.currency} ${rating.price}` : 'Not fetched'}</strong>
                                </div>
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
