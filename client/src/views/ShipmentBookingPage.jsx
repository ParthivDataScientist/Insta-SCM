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

const defaultForm = {
    receiver: {
        company_name: '',
        name: '',
        email: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        address_line3: '',
        city: '',
        state_code: '',
        postal_code: '',
        country_code: '',
        country_name: '',
    },
    package: {
        pieces: 1,
        weight_kg: '',
        length_cm: '',
        width_cm: '',
        height_cm: '',
        declared_value: 0,
        declared_currency: 'USD',
    },
    shipment: {
        description: '',
        service_type: 'P',
        local_product_code: '',
        terms_of_trade: 'DAP',
        shipping_payment_type: 'S',
        duty_payment_type: 'R',
        is_dutiable: true,
        shipper_reference: '',
        exhibition_name: '',
        show_date: '',
    },
};

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
    const requiredTextFields = [
        ['receiver.name', form.receiver.name],
        ['receiver.phone', form.receiver.phone],
        ['receiver.address_line1', form.receiver.address_line1],
        ['receiver.city', form.receiver.city],
        ['receiver.postal_code', form.receiver.postal_code],
        ['receiver.country_code', form.receiver.country_code],
        ['shipment.description', form.shipment.description],
    ];

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
            local_product_code: form.shipment.local_product_code || null,
            terms_of_trade: form.shipment.terms_of_trade || null,
            shipping_payment_type: form.shipment.shipping_payment_type || null,
            duty_payment_type: form.shipment.duty_payment_type || null,
            shipper_reference: form.shipment.shipper_reference || null,
            exhibition_name: form.shipment.exhibition_name || null,
            show_date: form.shipment.show_date || null,
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
    const [form, setForm] = useState(defaultForm);
    const [rating, setRating] = useState(null);
    const [created, setCreated] = useState(null);
    const [pickup, setPickup] = useState(null);
    const [error, setError] = useState('');
    const [ratingLoading, setRatingLoading] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [pickupLoading, setPickupLoading] = useState(false);

    const payload = useMemo(() => buildPayload(form), [form]);
    const validationError = useMemo(() => validateBookingForm(form), [form]);

    const updateSection = (section, field, value) => {
        setForm((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
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
                        <h1>Book a shipment without leaving the tracking workspace.</h1>
                        <p>Rate the shipment, confirm the booking, save the DHL label, and schedule pickup from one flow.</p>
                    </div>
                    <Link to="/dashboard" className="design-premium-btn">
                        <ArrowLeft size={15} /> Back to Dashboard
                    </Link>
                </div>

                <section className="shipment-booking-origin">
                    <div className="shipment-booking-origin__eyebrow">Shipping From</div>
                    <h2>{shipperAddress.site_name}</h2>
                    <p>
                        {shipperAddress.company_name}, {shipperAddress.address_line1}, {shipperAddress.address_line2},{' '}
                        {shipperAddress.city}, {shipperAddress.state} - {shipperAddress.postal_code}, {shipperAddress.country_code}
                    </p>
                </section>

                <div className="shipment-booking-grid">
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
                </div>

                <section className="shipment-booking-summary">
                    <div className="shipment-booking-summary__card">
                        <div className="shipment-booking-summary__icon">
                            <Receipt size={18} />
                        </div>
                        <div>
                            <div className="shipment-booking-summary__label">Step 1</div>
                            <div className="shipment-booking-summary__title">Rate Shipment</div>
                            <div className="shipment-booking-summary__value">
                                {rating ? `${rating.currency} ${rating.price}` : 'Waiting for rate'}
                            </div>
                            <div className="shipment-booking-summary__meta">{rating?.delivery_time || 'Delivery time will appear here.'}</div>
                        </div>
                        <button className="design-premium-btn design-premium-btn--primary" onClick={handleRate} disabled={Boolean(validationError) || ratingLoading || createLoading}>
                            {ratingLoading ? <Loader size={16} className="animate-spin" /> : <><Receipt size={16} /> Rate</>}
                        </button>
                    </div>

                    <div className="shipment-booking-summary__card">
                        <div className="shipment-booking-summary__icon">
                            <CheckCircle2 size={18} />
                        </div>
                        <div>
                            <div className="shipment-booking-summary__label">Step 2</div>
                            <div className="shipment-booking-summary__title">Create Shipment</div>
                            <div className="shipment-booking-summary__value">{created?.awb || 'AWB will appear after booking'}</div>
                            <div className="shipment-booking-summary__meta">{created?.label_url || 'DHL label will be saved automatically.'}</div>
                        </div>
                        <button className="design-premium-btn design-premium-btn--primary" onClick={handleCreate} disabled={Boolean(validationError) || createLoading || ratingLoading}>
                            {createLoading ? <Loader size={16} className="animate-spin" /> : <><Truck size={16} /> Create</>}
                        </button>
                    </div>

                    <div className="shipment-booking-summary__card">
                        <div className="shipment-booking-summary__icon">
                            <CalendarClock size={18} />
                        </div>
                        <div>
                            <div className="shipment-booking-summary__label">Step 3</div>
                            <div className="shipment-booking-summary__title">Schedule Pickup</div>
                            <div className="shipment-booking-summary__value">{pickup?.pickup_id || 'Pickup confirmation pending'}</div>
                            <div className="shipment-booking-summary__meta">{pickup?.pickup_status || 'Runs after booking using stored AWB.'}</div>
                        </div>
                        <button className="design-premium-btn" onClick={handlePickup} disabled={!created?.awb || pickupLoading}>
                            {pickupLoading ? <Loader size={16} className="animate-spin" /> : <><CalendarClock size={16} /> Pickup</>}
                        </button>
                    </div>
                </section>

                {created ? (
                    <section className="shipment-booking-result">
                        <div>
                            <div className="shipment-booking-result__eyebrow">Booked Shipment</div>
                            <h2>{created.awb}</h2>
                            <p>The AWB has been saved into the tracking database, so it will now show up on the shipment dashboard.</p>
                        </div>
                        <div className="shipment-booking-result__actions">
                            <a className="design-premium-btn design-premium-btn--primary" href={created.label_url} target="_blank" rel="noreferrer">
                                <Tag size={16} /> Download Label
                            </a>
                            <Link to="/dashboard" className="design-premium-btn">
                                <Truck size={16} /> Open Tracking Dashboard
                            </Link>
                        </div>
                    </section>
                ) : null}
            </div>
        </AppShell>
    );
}
