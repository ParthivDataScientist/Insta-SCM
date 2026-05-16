import React, { useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, Loader, Receipt, Tag, Truck } from 'lucide-react';
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

export default function ShipmentBookingPage() {
    const [form, setForm] = useState(() => createTestBookingForm());
    const [rating, setRating] = useState(null);
    const [created, setCreated] = useState(null);
    const [pickup, setPickup] = useState(null);
    const [error, setError] = useState('');
    const [ratingLoading, setRatingLoading] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [pickupLoading, setPickupLoading] = useState(false);

    const payload = useMemo(() => buildPayload(form), [form]);
    const validationError = useMemo(() => validateBookingForm(form), [form]);
    const isCommercialShipment = form.shipment.shipment_type !== 'NORMAL';
    const isCsbVShipment = form.shipment.shipment_type === 'CSB_V';

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
    };

    const handleRate = async () => {
        if (validationError) {
            setError(validationError);
            return;
        }
        setRatingLoading(true);
        setError('');
        try {
            const result = await shipmentsService.rateShipment(payload);
            setRating(result);
            setCreated(null);
            setPickup(null);
        } catch (err) {
            setError(normalizeApiError(err, 'Failed to rate shipment'));
        } finally {
            setRatingLoading(false);
        }
    };

    const handleCreate = async () => {
        if (validationError) {
            setError(validationError);
            return;
        }
        setCreateLoading(true);
        setError('');
        try {
            const result = await shipmentsService.createShipment(payload);
            setCreated(result);
            setPickup(null);
        } catch (err) {
            setError(normalizeApiError(err, 'Failed to create shipment'));
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
        } finally {
            setPickupLoading(false);
        }
    };

    return (
        <AppShell
            activeNav="dashboard"
            showGlobalDate={false}
            pageClassName="shipment-booking-page"
            mainClassName="premium-main--design"
        >
            <AlertBanner message={error} />

            <div className="shipment-booking-shell">
                <div className="shipment-booking-hero">
                    <div>
                        <div className="shipment-booking-hero__eyebrow">DHL Booking</div>
                        <h1>Shipment Booking</h1>
                    </div>
                    <div className="shipment-booking-result__actions">
                        <button type="button" className="design-premium-btn" onClick={fillTestData}>
                            <Receipt size={15} /> Fill Test Data
                        </button>
                        <Link to="/dashboard" className="design-premium-btn">
                            <ArrowLeft size={15} /> Back to Dashboard
                        </Link>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '24px', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <section className="shipment-booking-origin">
                            <div className="shipment-booking-origin__eyebrow">Shipping From</div>
                            <h2>{shipperAddress.site_name}</h2>
                            <p>
                                {shipperAddress.company_name}, {shipperAddress.address_line1}, {shipperAddress.address_line2},{' '}
                                {shipperAddress.city}, {shipperAddress.state} - {shipperAddress.postal_code}, {shipperAddress.country_code}
                            </p>
                        </section>

                        <section className="shipment-booking-card">
                            <div className="shipment-booking-card__header">
                                <Truck size={18} />
                                <div>
                                    <h2>Receiver Details</h2>
                                    <p>These fields feed the DHL shipment request directly.</p>
                                </div>
                            </div>
                            <div className="shipment-booking-form-grid">
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
                                <BookingField label="Address Line 1">
                                    <input className="booking-input" value={form.receiver.address_line1} onChange={(event) => updateSection('receiver', 'address_line1', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Address Line 2">
                                    <input className="booking-input" value={form.receiver.address_line2} onChange={(event) => updateSection('receiver', 'address_line2', event.target.value)} />
                                </BookingField>
                                <BookingField label="City">
                                    <input className="booking-input" value={form.receiver.city} onChange={(event) => updateSection('receiver', 'city', event.target.value)} required />
                                </BookingField>
                                <BookingField label="State Code">
                                    <input className="booking-input" value={form.receiver.state_code} onChange={(event) => updateSection('receiver', 'state_code', event.target.value)} />
                                </BookingField>
                                <BookingField label="Postal Code">
                                    <input className="booking-input" value={form.receiver.postal_code} onChange={(event) => updateSection('receiver', 'postal_code', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Country Code" hint="ISO 2-letter code">
                                    <input className="booking-input" value={form.receiver.country_code} onChange={(event) => updateSection('receiver', 'country_code', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Country Name">
                                    <input className="booking-input" value={form.receiver.country_name} onChange={(event) => updateSection('receiver', 'country_name', event.target.value)} />
                                </BookingField>
                            </div>
                        </section>

                        <section className="shipment-booking-card">
                            <div className="shipment-booking-card__header">
                                <Tag size={18} />
                                <div>
                                    <h2>Package and Service</h2>
                                    <p>Dimensions and service data are used for both rate and shipment booking.</p>
                                </div>
                            </div>
                            <div className="shipment-booking-form-grid">
                                <BookingField label="Shipment Type">
                                    <select className="booking-input" value={form.shipment.shipment_type} onChange={(event) => updateSection('shipment', 'shipment_type', event.target.value)}>
                                        <option value="NORMAL">Normal</option>
                                        <option value="CSB_IV_CARGO">CSB-IV Cargo</option>
                                        <option value="CSB_V">CSB-V</option>
                                    </select>
                                </BookingField>
                                <BookingField label="Description">
                                    <input className="booking-input" value={form.shipment.description} onChange={(event) => updateSection('shipment', 'description', event.target.value)} required />
                                </BookingField>
                                <BookingField label="Service Type">
                                    <input className="booking-input" value={form.shipment.service_type} onChange={(event) => updateSection('shipment', 'service_type', event.target.value)} />
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
                                <BookingField label="Declared Value">
                                    <input className="booking-input" type="text" inputMode="decimal" value={form.package.declared_value} onChange={(event) => updateSection('package', 'declared_value', event.target.value)} />
                                </BookingField>
                                <BookingField label="Currency">
                                    <input className="booking-input" value={form.package.declared_currency} onChange={(event) => updateSection('package', 'declared_currency', event.target.value)} />
                                </BookingField>
                                <BookingField label="Terms of Trade">
                                    <input className="booking-input" value={form.shipment.terms_of_trade} onChange={(event) => updateSection('shipment', 'terms_of_trade', event.target.value)} />
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
                        </section>

                        {isCommercialShipment ? <section className="shipment-booking-card">
                            <div className="shipment-booking-card__header">
                                <Receipt size={18} />
                                <div>
                                    <h2>{isCsbVShipment ? 'CSB-V Commercial Details' : 'CSB-IV Cargo Details'}</h2>
                                    <p>These fields are required by DHL for export booking and label generation.</p>
                                </div>
                            </div>
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
                                        <BookingField label="Shipper State Code">
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
                        </section> : null}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '24px' }}>
                        <div className="shipment-booking-summary__card" style={{ padding: '20px' }}>
                            <div className="shipment-booking-summary__icon" style={{ marginBottom: '16px' }}>
                                <Receipt size={18} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <div className="shipment-booking-summary__label">Step 1</div>
                                <div className="shipment-booking-summary__title">Rate Shipment</div>
                                <div className="shipment-booking-summary__value">
                                    {rating ? `${rating.currency} ${rating.price}` : 'Waiting for rate'}
                                </div>
                                <div className="shipment-booking-summary__meta">{rating?.delivery_time || 'Delivery time will appear here.'}</div>
                            </div>
                            <button className="design-premium-btn design-premium-btn--primary" style={{ width: '100%' }} onClick={handleRate} disabled={Boolean(validationError) || ratingLoading || createLoading}>
                                {ratingLoading ? <Loader size={16} className="animate-spin" /> : <><Receipt size={16} /> Rate</>}
                            </button>
                        </div>

                        <div className="shipment-booking-summary__card" style={{ padding: '20px' }}>
                            <div className="shipment-booking-summary__icon" style={{ marginBottom: '16px' }}>
                                <CheckCircle2 size={18} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <div className="shipment-booking-summary__label">Step 2</div>
                                <div className="shipment-booking-summary__title">Create Shipment</div>
                                <div className="shipment-booking-summary__value">{created?.awb || 'AWB will appear after booking'}</div>
                                <div className="shipment-booking-summary__meta">
                                    {created?.label_url ? (
                                        <a href={created.label_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 500 }}>
                                            View PDF Label
                                        </a>
                                    ) : (
                                        'DHL label will be saved automatically.'
                                    )}
                                </div>
                            </div>
                            <button className="design-premium-btn design-premium-btn--primary" style={{ width: '100%' }} onClick={handleCreate} disabled={Boolean(validationError) || createLoading || ratingLoading}>
                                {createLoading ? <Loader size={16} className="animate-spin" /> : <><Truck size={16} /> Create</>}
                            </button>
                        </div>

                        <div className="shipment-booking-summary__card" style={{ padding: '20px' }}>
                            <div className="shipment-booking-summary__icon" style={{ marginBottom: '16px' }}>
                                <CalendarClock size={18} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <div className="shipment-booking-summary__label">Step 3</div>
                                <div className="shipment-booking-summary__title">Schedule Pickup</div>
                                <div className="shipment-booking-summary__value">{pickup?.pickup_id || 'Pickup confirmation pending'}</div>
                                <div className="shipment-booking-summary__meta">{pickup?.pickup_status || 'Runs after booking using stored AWB.'}</div>
                            </div>
                            <button className="design-premium-btn" style={{ width: '100%' }} onClick={handlePickup} disabled={!created?.awb || pickupLoading}>
                                {pickupLoading ? <Loader size={16} className="animate-spin" /> : <><CalendarClock size={16} /> Pickup</>}
                            </button>
                        </div>

                        {created ? (
                            <section className="shipment-booking-result" style={{ padding: '20px', marginTop: '8px' }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <div className="shipment-booking-result__eyebrow">Booked Shipment</div>
                                    <h2 style={{ wordBreak: 'break-all' }}>{created.awb}</h2>
                                    <p style={{ fontSize: '13px' }}>The AWB has been saved into the tracking database.</p>
                                </div>
                                <div className="shipment-booking-result__actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <a className="design-premium-btn design-premium-btn--primary" style={{ width: '100%' }} href={created.label_url} target="_blank" rel="noreferrer">
                                        <Tag size={16} /> Download Label
                                    </a>
                                    <Link to="/dashboard" className="design-premium-btn" style={{ width: '100%' }}>
                                        <Truck size={16} /> Tracking Dashboard
                                    </Link>
                                </div>
                            </section>
                        ) : null}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
